//! OCI 이미지: Docker Hub에서 받아 검증하고, 레이어를 풀어 둔다.
//!
//! 저장소 구조 (/var/lib/myctr)
//!   blobs/sha256/<hex>     내용 주소 저장소: 매니페스트, config, 압축된 레이어
//!   layers/<hex>/          풀어 둔 레이어 (overlayfs의 lowerdir로 쓴다)
//!   refs/<repo>/<tag>      이름 → 매니페스트 digest

use std::ffi::CString;
use std::fs::{self, File};
use std::io::{self, Read, Write};
use std::os::unix::ffi::OsStrExt;
use std::path::{Component, Path, PathBuf};

use anyhow::{Context, Result, bail};
use flate2::read::GzDecoder;
use nix::libc;
use nix::sys::stat::{Mode, SFlag, makedev, mknod};
use serde::Deserialize;
use sha2::{Digest, Sha256};

pub const STORE: &str = "/var/lib/myctr";
const REGISTRY: &str = "https://registry-1.docker.io";
const AUTH: &str = "https://auth.docker.io/token?service=registry.docker.io";
const ACCEPT: &str = "application/vnd.oci.image.index.v1+json, \
    application/vnd.docker.distribution.manifest.list.v2+json, \
    application/vnd.oci.image.manifest.v1+json, \
    application/vnd.docker.distribution.manifest.v2+json";

/// 풀어 둔 이미지: 레이어 디렉터리(아래 → 위)와 실행 설정
pub struct Image {
    pub layers: Vec<PathBuf>,
    pub config: RunConfig,
}

/// 이미지 config의 "config" 부분 중 런타임이 쓰는 것
#[derive(Deserialize, Default)]
#[serde(rename_all = "PascalCase")]
pub struct RunConfig {
    #[serde(default)]
    pub env: Vec<String>,
    pub cmd: Option<Vec<String>>,
    pub entrypoint: Option<Vec<String>>,
    #[serde(default)]
    pub working_dir: String,
}

#[derive(Deserialize)]
struct ConfigBlob {
    #[serde(default)]
    config: RunConfig,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Descriptor {
    media_type: String,
    digest: String,
    platform: Option<Platform>,
}

#[derive(Deserialize)]
struct Platform {
    architecture: String,
    os: String,
}

/// 인덱스(멀티 플랫폼)와 매니페스트(단일 플랫폼)를 한 구조로 읽는다
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Manifest {
    #[serde(default)]
    media_type: String,
    #[serde(default)]
    manifests: Vec<Descriptor>,
    config: Option<Descriptor>,
    #[serde(default)]
    layers: Vec<Descriptor>,
}

/// "alpine", "alpine:3.24", "nginx:alpine", "user/app:1.0"
struct Reference {
    repo: String,
    tag: String,
}

impl Reference {
    fn parse(s: &str) -> Result<Self> {
        let (name, tag) = match s.rsplit_once(':') {
            Some((n, t)) if !t.contains('/') => (n, t),
            _ => (s, "latest"),
        };
        if name.split('/').next().is_some_and(|first| first.contains('.') || first.contains(':')) {
            bail!("{s}: Docker Hub 이미지만 지원합니다 (레지스트리 주소 없이 써 주세요)");
        }
        let repo = if name.contains('/') { name.to_string() } else { format!("library/{name}") };
        Ok(Reference { repo, tag: tag.to_string() })
    }

    fn ref_path(&self) -> PathBuf {
        Path::new(STORE).join("refs").join(&self.repo).join(&self.tag)
    }
}

/// 로컬에 있으면 그대로, 없으면 받아 온다
pub fn ensure(name: &str) -> Result<Image> {
    let r = Reference::parse(name)?;
    match fs::read_to_string(r.ref_path()) {
        Ok(digest) => load(digest.trim()),
        Err(_) => pull(name),
    }
}

pub fn pull(name: &str) -> Result<Image> {
    let r = Reference::parse(name)?;
    let token = token(&r.repo)?;

    // 1. 태그 → 매니페스트. 대개 여러 플랫폼을 담은 인덱스가 온다
    let (mut digest, mut bytes) = fetch_manifest(&r.repo, &r.tag, &token)?;
    let mut manifest: Manifest = serde_json::from_slice(&bytes).context("매니페스트 해석")?;
    if !manifest.manifests.is_empty() {
        let (arch, os) = (platform_arch(), "linux");
        let d = manifest
            .manifests
            .iter()
            .find(|d| d.platform.as_ref().is_some_and(|p| p.architecture == arch && p.os == os))
            .with_context(|| format!("{name}: {os}/{arch} 플랫폼이 없습니다"))?;
        println!("index  {} → {os}/{arch} {}", short(&digest), short(&d.digest));
        (digest, bytes) = fetch_manifest(&r.repo, &d.digest, &token)?;
        manifest = serde_json::from_slice(&bytes).context("매니페스트 해석")?;
    }
    store_blob(&digest, &bytes)?;
    println!("manifest {} ({})", short(&digest), manifest.media_type);

    // 2. config와 레이어 blob. 받으면서 sha256을 계산해 digest와 비교한다
    let config = manifest.config.as_ref().context("매니페스트에 config가 없습니다")?;
    fetch_blob(&r.repo, &config.digest, &token)?;
    for layer in &manifest.layers {
        fetch_blob(&r.repo, &layer.digest, &token)?;
        unpack_layer(layer)?;
    }

    // 3. 이름표는 마지막에 붙인다. 중간에 실패하면 이름이 생기지 않는다
    let ref_path = r.ref_path();
    fs::create_dir_all(ref_path.parent().unwrap())?;
    fs::write(&ref_path, &digest)?;
    println!("{}:{} → {}", r.repo, r.tag, short(&digest));
    load(&digest)
}

/// 로컬 이미지 목록
pub fn list() -> Result<()> {
    let refs = Path::new(STORE).join("refs");
    let mut found = Vec::new();
    walk_refs(&refs, &refs, &mut found)?;
    println!("{:<32} {:<14} {:>6}", "IMAGE", "MANIFEST", "LAYERS");
    for (name, digest) in found {
        let layers = read_manifest(&digest).map(|m| m.layers.len()).unwrap_or(0);
        println!("{name:<32} {:<14} {layers:>6}", short(&digest));
    }
    Ok(())
}

fn walk_refs(root: &Path, dir: &Path, out: &mut Vec<(String, String)>) -> Result<()> {
    let Ok(entries) = fs::read_dir(dir) else { return Ok(()) };
    for e in entries {
        let path = e?.path();
        if path.is_dir() {
            walk_refs(root, &path, out)?;
        } else {
            let rel = path.strip_prefix(root)?;
            let tag = rel.file_name().unwrap().to_string_lossy();
            let repo = rel.parent().unwrap().to_string_lossy();
            out.push((format!("{repo}:{tag}"), fs::read_to_string(&path)?.trim().to_string()));
        }
    }
    Ok(())
}

fn load(manifest_digest: &str) -> Result<Image> {
    let manifest = read_manifest(manifest_digest)?;
    let config = manifest.config.context("매니페스트에 config가 없습니다")?;
    let blob: ConfigBlob = serde_json::from_slice(&fs::read(blob_path(&config.digest)?)?)
        .context("이미지 config 해석")?;
    let layers = manifest
        .layers
        .iter()
        .map(|l| layer_path(&l.digest))
        .collect::<Result<_>>()?;
    Ok(Image { layers, config: blob.config })
}

fn read_manifest(digest: &str) -> Result<Manifest> {
    let bytes = fs::read(blob_path(digest)?).with_context(|| format!("매니페스트 {digest}"))?;
    serde_json::from_slice(&bytes).context("매니페스트 해석")
}

/// uname의 아키텍처 이름 → OCI 플랫폼 이름
fn platform_arch() -> &'static str {
    match std::env::consts::ARCH {
        "x86_64" => "amd64",
        "aarch64" => "arm64",
        other => other,
    }
}

fn short(digest: &str) -> &str {
    let hex = digest.strip_prefix("sha256:").unwrap_or(digest);
    &hex[..hex.len().min(12)]
}

/// "sha256:<64자리>" 만 받는다. 경로로 쓰이므로 다른 글자가 섞이면 안 된다
fn digest_hex(digest: &str) -> Result<&str> {
    match digest.strip_prefix("sha256:") {
        Some(h) if h.len() == 64 && h.bytes().all(|b| b.is_ascii_hexdigit()) => Ok(h),
        _ => bail!("지원하지 않는 digest: {digest}"),
    }
}

fn blob_path(digest: &str) -> Result<PathBuf> {
    Ok(Path::new(STORE).join("blobs/sha256").join(digest_hex(digest)?))
}

fn layer_path(digest: &str) -> Result<PathBuf> {
    Ok(Path::new(STORE).join("layers").join(digest_hex(digest)?))
}

/// 익명 pull 토큰 (Docker Hub)
fn token(repo: &str) -> Result<String> {
    #[derive(Deserialize)]
    struct Token {
        token: String,
    }
    let url = format!("{AUTH}&scope=repository:{repo}:pull");
    let t: Token = ureq::get(&url).call().context("토큰 요청")?.into_json()?;
    Ok(t.token)
}

/// 매니페스트를 받아 (digest, 원본 바이트)를 돌려준다
fn fetch_manifest(repo: &str, reference: &str, token: &str) -> Result<(String, Vec<u8>)> {
    let url = format!("{REGISTRY}/v2/{repo}/manifests/{reference}");
    let resp = ureq::get(&url)
        .set("Authorization", &format!("Bearer {token}"))
        .set("Accept", ACCEPT)
        .call()
        .with_context(|| format!("매니페스트 요청 {repo}:{reference}"))?;
    let mut bytes = Vec::new();
    resp.into_reader().read_to_end(&mut bytes)?;
    // digest는 원본 바이트의 sha256이다. 서버가 알려 주는 값을 믿지 않고 직접 계산한다
    let digest = format!("sha256:{:x}", Sha256::digest(&bytes));
    if reference.starts_with("sha256:") && reference != digest {
        bail!("매니페스트 digest 불일치: 요청 {reference}, 실제 {digest}");
    }
    Ok((digest, bytes))
}

fn store_blob(digest: &str, bytes: &[u8]) -> Result<()> {
    let path = blob_path(digest)?;
    fs::create_dir_all(path.parent().unwrap())?;
    fs::write(&path, bytes)?;
    Ok(())
}

/// blob을 받으며 sha256을 계산하고, 맞을 때만 제자리에 놓는다
fn fetch_blob(repo: &str, digest: &str, token: &str) -> Result<()> {
    let path = blob_path(digest)?;
    if path.exists() {
        println!("blob   {} 이미 있음", short(digest));
        return Ok(());
    }
    fs::create_dir_all(path.parent().unwrap())?;
    let url = format!("{REGISTRY}/v2/{repo}/blobs/{digest}");
    // 레지스트리는 CDN 주소로 리다이렉트한다. ureq는 다른 호스트로 갈 때 Authorization을 떼어 낸다
    let resp = ureq::get(&url)
        .set("Authorization", &format!("Bearer {token}"))
        .call()
        .with_context(|| format!("blob 요청 {digest}"))?;
    let tmp = path.with_extension("partial");
    let mut out = File::create(&tmp)?;
    let mut hasher = Sha256::new();
    let mut reader = resp.into_reader();
    let mut buf = vec![0u8; 64 * 1024];
    let mut total = 0u64;
    loop {
        let n = reader.read(&mut buf)?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
        out.write_all(&buf[..n])?;
        total += n as u64;
    }
    let actual = format!("sha256:{:x}", hasher.finalize());
    if actual != digest {
        let _ = fs::remove_file(&tmp);
        bail!("blob digest 불일치: 기대 {digest}, 실제 {actual}");
    }
    fs::rename(&tmp, &path)?;
    println!("blob   {} {:.1} MB 검증 완료", short(digest), total as f64 / 1e6);
    Ok(())
}

/// 레이어 tar를 풀어 둔다. OCI whiteout을 overlayfs 형식으로 바꾼다
fn unpack_layer(layer: &Descriptor) -> Result<()> {
    let dest = layer_path(&layer.digest)?;
    if dest.exists() {
        return Ok(());
    }
    let file = File::open(blob_path(&layer.digest)?)?;
    let reader: Box<dyn Read> = if layer.media_type.ends_with("gzip") {
        Box::new(GzDecoder::new(file))
    } else if layer.media_type.ends_with(".tar") || layer.media_type.ends_with("tar") {
        Box::new(file)
    } else {
        bail!("지원하지 않는 레이어 형식: {}", layer.media_type);
    };
    // 다 풀린 뒤에 이름을 바꿔, 반쯤 풀린 레이어가 쓰이지 않게 한다
    let tmp = dest.with_extension("partial");
    let _ = fs::remove_dir_all(&tmp);
    fs::create_dir_all(&tmp)?;

    let mut archive = tar::Archive::new(reader);
    archive.set_preserve_permissions(true);
    archive.set_preserve_ownerships(true);
    archive.set_unpack_xattrs(true);
    let mut whiteouts = 0;
    for entry in archive.entries()? {
        let mut entry = entry?;
        let path = entry.path()?.into_owned();
        let name = path.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default();
        if name.starts_with(".wh.") {
            // whiteout 경로는 tar 크레이트의 경로 검사를 거치지 않으므로 직접 확인한다
            if !path.components().all(|c| matches!(c, Component::Normal(_) | Component::CurDir)) {
                bail!("잘못된 whiteout 경로: {}", path.display());
            }
            let dir = tmp.join(path.parent().unwrap_or(Path::new("")));
            fs::create_dir_all(&dir)?;
            if name == ".wh..wh..opq" {
                // 디렉터리 전체 가리기: 아래 레이어의 같은 디렉터리 내용을 보이지 않게
                set_opaque(&dir)?;
            } else {
                // 파일 하나 가리기: 같은 이름의 0:0 문자 장치
                let hidden = dir.join(&name[4..]);
                mknod(&hidden, SFlag::S_IFCHR, Mode::empty(), makedev(0, 0))
                    .with_context(|| format!("whiteout {}", hidden.display()))?;
            }
            whiteouts += 1;
            continue;
        }
        entry.unpack_in(&tmp).with_context(|| format!("{} 풀기", path.display()))?;
    }
    fs::rename(&tmp, &dest)?;
    println!("layer  {} 풀기 완료 (whiteout {whiteouts}개)", short(&layer.digest));
    Ok(())
}

fn set_opaque(dir: &Path) -> Result<()> {
    let path = CString::new(dir.as_os_str().as_bytes())?;
    let rc = unsafe {
        libc::setxattr(path.as_ptr(), c"trusted.overlay.opaque".as_ptr(), b"y".as_ptr().cast(), 1, 0)
    };
    if rc != 0 {
        return Err(io::Error::last_os_error()).with_context(|| format!("opaque {}", dir.display()));
    }
    Ok(())
}


#[cfg(test)]
mod fixture_tests {
    use super::*;
    use std::os::unix::fs::{FileTypeExt, MetadataExt};

    /// 실제 unpack_layer로 whiteout을 변환하는 명시적 root 전용 fixture.
    /// 기본 cargo test에서는 실행하지 않는다. 먼저 alpine:3.24를 pull해야 한다.
    #[test]
    #[ignore = "전용 Linux root 실습: alpine:3.24 pull 후 --ignored로 실행"]
    fn prepare_whiteout_fixture() -> Result<()> {
        if unsafe { libc::geteuid() } != 0 { bail!("root fixture입니다"); }
        let reference = Reference::parse("alpine:3.24")?;
        let base = fs::read_to_string(reference.ref_path()).context("먼저 alpine:3.24 pull")?;
        let base_bytes = fs::read(blob_path(base.trim())?)?;
        let mut manifest: serde_json::Value = serde_json::from_slice(&base_bytes)?;
        for entries in [
            vec![("course/remove", "gone"), ("course/opaque/old", "gone")],
            vec![("course/.wh.remove", ""), ("course/opaque/.wh..wh..opq", ""), ("course/opaque/new", "present")],
        ] {
            let has_whiteout = entries.iter().any(|(name, _)| name.contains(".wh."));
            let mut archive = tar::Builder::new(Vec::new());
            for (name, content) in entries {
                let mut header = tar::Header::new_gnu();
                header.set_size(content.len() as u64);
                header.set_mode(0o644); header.set_uid(0); header.set_gid(0); header.set_mtime(0);
                header.set_cksum();
                archive.append_data(&mut header, name, content.as_bytes())?;
            }
            let bytes = archive.into_inner()?;
            let digest = format!("sha256:{:x}", Sha256::digest(&bytes));
            store_blob(&digest, &bytes)?;
            let media_type = "application/vnd.oci.image.layer.v1.tar";
            unpack_layer(&Descriptor { media_type: media_type.into(), digest: digest.clone(), platform: None })?;
            if has_whiteout {
                let meta = fs::symlink_metadata(layer_path(&digest)?.join("course/remove"))?;
                if !meta.file_type().is_char_device() || meta.rdev() != 0 {
                    bail!("whiteout이 0:0 문자 장치가 아닙니다");
                }
                let path = CString::new(layer_path(&digest)?.join("course/opaque").as_os_str().as_bytes())?;
                let mut opaque = [0u8; 1];
                let n = unsafe { libc::getxattr(path.as_ptr(), c"trusted.overlay.opaque".as_ptr(), opaque.as_mut_ptr().cast(), 1) };
                if n != 1 || opaque != *b"y" { bail!("opaque xattr 변환 실패"); }
            }
            manifest["layers"].as_array_mut().context("layers")?.push(serde_json::json!({
                "mediaType": media_type, "digest": digest, "size": bytes.len(),
            }));
        }
        let bytes = serde_json::to_vec(&manifest)?;
        let digest = format!("sha256:{:x}", Sha256::digest(&bytes));
        store_blob(&digest, &bytes)?;
        let path = Reference::parse("course/whiteout:fixture")?.ref_path();
        fs::create_dir_all(path.parent().unwrap())?;
        fs::write(path, digest)?;
        Ok(())
    }
}
