use std::collections::BTreeMap;
use std::ffi::{CStr, CString, OsStr};
use std::fs::{self, File, OpenOptions};
use std::io::Write;
use std::net::IpAddr;
use std::os::unix::fs::OpenOptionsExt;
use std::os::fd::{AsRawFd, RawFd};
use std::os::unix::ffi::OsStrExt;
use std::os::unix::fs::symlink;
use std::path::{Path, PathBuf};
use std::process::Command as Cmd;

use anyhow::{Context, Result, anyhow, bail};
use caps::{CapSet, Capability, CapsHashSet};
use clap::{Parser, Subcommand, ValueEnum};
use nix::errno::Errno;
use nix::fcntl::OFlag;
use nix::libc;
use nix::mount::{MntFlags, MsFlags, mount, umount2};
use nix::sched::{CloneFlags, clone};
use nix::sys::prctl;
use nix::sys::signal::{SigHandler, Signal, signal};
use nix::sys::wait::{WaitStatus, waitpid};
use seccompiler::{BpfProgram, SeccompAction, SeccompFilter, SeccompRule};
use nix::unistd::{
    AccessFlags, ForkResult, Gid, Pid, Uid, access, chdir, close, execve, execvp, fork, pipe2,
    pivot_root, read, setgid, setgroups, sethostname, setuid, write,
};

mod image;

const STACK_SIZE: usize = 1024 * 1024;
const OLD_ROOT: &str = ".oldroot";
/// 호스트에서 빌려 올 장치 파일
const DEVICES: [&str; 6] = ["null", "zero", "full", "random", "urandom", "tty"];
/// 이미지가 PATH를 정하지 않았을 때 쓰는 값 (Docker와 같음)
const DEFAULT_PATH: &str = "/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin";
const CGROUP_ROOT: &str = "/sys/fs/cgroup";
/// myctr가 만드는 모든 컨테이너 cgroup의 부모
const CGROUP_PARENT: &str = "myctr";
const CPU_PERIOD_US: u64 = 100_000;
/// --userns-base 로 매핑할 ID 개수
const USERNS_RANGE: u32 = 65536;
/// 모든 컨테이너가 붙는 브리지와 그 대역
const BRIDGE: &str = "myctr0";
const SUBNET: &str = "10.88.0.0/24";
const GATEWAY: &str = "10.88.0.1";
/// 기본으로 남겨 두는 capability (Docker 기본값과 같은 14개)
const DEFAULT_CAPS: [Capability; 14] = [
    Capability::CAP_CHOWN,
    Capability::CAP_DAC_OVERRIDE,
    Capability::CAP_FSETID,
    Capability::CAP_FOWNER,
    Capability::CAP_MKNOD,
    Capability::CAP_NET_RAW,
    Capability::CAP_SETGID,
    Capability::CAP_SETUID,
    Capability::CAP_SETFCAP,
    Capability::CAP_SETPCAP,
    Capability::CAP_NET_BIND_SERVICE,
    Capability::CAP_SYS_CHROOT,
    Capability::CAP_KILL,
    Capability::CAP_AUDIT_WRITE,
];
/// seccomp로 막는 시스템 콜. 호출하면 EPERM이 돌아온다
const BLOCKED_SYSCALLS: [(&str, i64); 24] = [
    // 파일시스템과 네임스페이스 구조 바꾸기
    ("mount", libc::SYS_mount),
    ("umount2", libc::SYS_umount2),
    ("pivot_root", libc::SYS_pivot_root),
    ("unshare", libc::SYS_unshare),
    ("setns", libc::SYS_setns),
    ("open_by_handle_at", libc::SYS_open_by_handle_at),
    // 커널 자체를 바꾸기
    ("init_module", libc::SYS_init_module),
    ("finit_module", libc::SYS_finit_module),
    ("delete_module", libc::SYS_delete_module),
    ("kexec_load", libc::SYS_kexec_load),
    ("reboot", libc::SYS_reboot),
    ("swapon", libc::SYS_swapon),
    ("swapoff", libc::SYS_swapoff),
    ("acct", libc::SYS_acct),
    // 호스트 전체가 공유하는 시계
    ("settimeofday", libc::SYS_settimeofday),
    ("clock_settime", libc::SYS_clock_settime),
    // 커널 키링
    ("keyctl", libc::SYS_keyctl),
    ("add_key", libc::SYS_add_key),
    ("request_key", libc::SYS_request_key),
    // 다른 프로세스나 커널 내부 관찰
    ("ptrace", libc::SYS_ptrace),
    ("perf_event_open", libc::SYS_perf_event_open),
    ("bpf", libc::SYS_bpf),
    ("syslog", libc::SYS_syslog),
    ("userfaultfd", libc::SYS_userfaultfd),
];

#[derive(Parser)]
#[command(name = "myctr", about = "나만의 컨테이너 런타임")]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Clone, Copy, PartialEq, ValueEnum)]
enum Net {
    /// 호스트의 네트워크를 그대로 쓴다
    Host,
    /// 새 네트워크 네임스페이스, loopback만
    None,
    /// 새 네트워크 네임스페이스 + veth + 브리지 + NAT (root 전용)
    Bridge,
}

#[derive(Subcommand)]
enum Command {
    /// Docker Hub에서 이미지를 받아 풀어 둔다 (예: alpine:3.24)
    Pull { image: String },
    /// 받아 둔 이미지 목록
    Images,
    /// 명령을 새 네임스페이스와 cgroup 안에서 실행한다
    Run {
        /// 컨테이너 안에서 보일 hostname
        #[arg(long, default_value = "myctr")]
        hostname: String,
        /// PID 1에 작은 init을 두고 명령은 PID 2로 실행한다
        #[arg(long)]
        init: bool,
        /// 메모리 상한 (예: 64M, 1G, 바이트 수)
        #[arg(long, value_parser = parse_bytes)]
        memory: Option<u64>,
        /// CPU 상한 (코어 수, 예: 0.5)
        #[arg(long)]
        cpus: Option<f64>,
        /// 최대 프로세스(스레드) 수
        #[arg(long)]
        pids: Option<u64>,
        /// (root 전용) 컨테이너의 UID/GID 0..65535 를 이 호스트 ID부터 매핑한다
        #[arg(long)]
        userns_base: Option<u32>,
        /// 네트워크 모드
        #[arg(long, value_enum, default_value = "none")]
        net: Net,
        /// 접근 가능한 DNS 서버 (반복 가능)
        #[arg(long)]
        dns: Vec<IpAddr>,
        /// 기본 capability에 더한다 (예: NET_ADMIN)
        #[arg(long = "cap-add", value_name = "CAP")]
        cap_add: Vec<String>,
        /// 기본 capability에서 뺀다 (ALL이면 전부)
        #[arg(long = "cap-drop", value_name = "CAP")]
        cap_drop: Vec<String>,
        /// seccomp 필터를 설치하지 않는다
        #[arg(long)]
        no_seccomp: bool,
        /// 이 디렉터리를 루트로 쓴다 (3장)
        #[arg(long, conflicts_with = "image", required_unless_present = "image")]
        rootfs: Option<PathBuf>,
        /// 이 이미지를 overlayfs로 쌓아 루트로 쓴다. 없으면 받아 온다
        #[arg(long)]
        image: Option<String>,
        /// 실행할 프로그램과 인자 (--image면 생략 시 이미지의 Cmd)
        #[arg(trailing_var_arg = true, allow_hyphen_values = true)]
        cmd: Vec<String>,
    },
}

struct Limits {
    memory: Option<u64>,
    cpus: Option<f64>,
    pids: Option<u64>,
}

impl Limits {
    fn any(&self) -> bool {
        self.memory.is_some() || self.cpus.is_some() || self.pids.is_some()
    }
}

/// 컨테이너의 루트를 어디서 가져오나
enum RootSpec {
    /// 디렉터리 하나 (3장)
    Dir(PathBuf),
    /// 이미지 레이어를 overlayfs로 쌓는다 (아래 → 위 순서)
    Image(Vec<PathBuf>),
}

/// 무엇을 실행하나
struct Program {
    argv: Vec<CString>,
    /// 이미지의 환경 변수. None이면 호스트 환경을 물려받는다
    env: Option<Vec<CString>>,
    /// 프로그램을 찾을 PATH (이미지 기준)
    path: String,
    workdir: String,
}

/// 자식이 새 루트를 꾸밀 때 쓰는 정보
struct RootSetup {
    /// pivot_root할 디렉터리 (Dir이면 그 디렉터리, Image면 merged)
    target: PathBuf,
    resolver: PathBuf,
    /// Image일 때 overlayfs 마운트 옵션
    overlay: Option<String>,
    /// 새 루트에 써 넣을 파일 (pivot_root 뒤, 컨테이너 경로 기준)
    files: Vec<(PathBuf, String)>,
}

/// clone된 자식에게 넘길 설정
struct Config {
    hostname: String,
    init: bool,
    program: Program,
    root: RootSetup,
    /// 부모가 준비를 마쳤다고 알려 주는 파이프 (읽는 쪽, 쓰는 쪽)
    sync: (RawFd, RawFd),
    userns: bool,
    clear_groups: bool,
    security: Security,
}

/// exec 직전에 적용할 권한 제한. 할당이 필요한 일은 clone 전에 끝내 둔다
struct Security {
    caps: CapsHashSet,
    seccomp: Option<BpfProgram>,
}

fn main() -> Result<()> {
    match Cli::parse().command {
        Command::Pull { image } => {
            image::pull(&image)?;
        }
        Command::Images => image::list()?,
        Command::Run {
            hostname, init, memory, cpus, pids, userns_base, net, dns, cap_add, cap_drop, no_seccomp,
            rootfs, image, cmd,
        } => {
            if image.is_some() && (!Uid::effective().is_root() || userns_base.is_some()) {
                bail!("--image는 root 실행이며 --userns-base가 없을 때만 지원합니다 (--rootfs는 rootless/range 가능)");
            }
            let security = Security::new(&cap_add, &cap_drop, no_seccomp)?;
            let (root, program) = prepare_root(rootfs, image, cmd, &hostname)?;
            let limits = Limits { memory, cpus, pids };
            let code = run(hostname, init, root, program, &limits, userns_base, net, dns, security)?;
            std::process::exit(code);
        }
    }
    Ok(())
}

fn to_cstrings(words: &[String]) -> Result<Vec<CString>> {
    words
        .iter()
        .map(|s| CString::new(s.as_bytes()))
        .collect::<Result<_, _>>()
        .context("인자에 NUL 바이트가 있습니다")
}

/// 루트와 실행할 프로그램을 정한다. 이미지면 Entrypoint + (명령 또는 Cmd), Env, WorkingDir
fn prepare_root(
    rootfs: Option<PathBuf>,
    image: Option<String>,
    cmd: Vec<String>,
    hostname: &str,
) -> Result<(RootSpec, Program)> {
    let Some(name) = image else {
        if cmd.is_empty() {
            bail!("실행할 명령이 없습니다");
        }
        let dir = rootfs.context("--rootfs 또는 --image를 지정하세요")?;
        let dir = fs::canonicalize(&dir)
            .with_context(|| format!("rootfs를 찾을 수 없습니다: {}", dir.display()))?;
        validate_rootfs(&dir)?;
        let root = RootSpec::Dir(dir);
        let program = Program { argv: to_cstrings(&cmd)?, env: None, path: String::new(), workdir: "/".into() };
        return Ok((root, program));
    };
    let img = image::ensure(&name)?;
    let c = img.config;
    let mut words = c.entrypoint.unwrap_or_default();
    words.extend(if cmd.is_empty() { c.cmd.unwrap_or_default() } else { cmd });
    if words.is_empty() {
        bail!("{name}: 이미지에 Cmd가 없으니 실행할 명령을 주세요");
    }
    // Docker처럼 HOSTNAME과 HOME을 더한다 (이미지에 없을 때만)
    let mut env = c.env;
    for (k, v) in [("HOSTNAME", hostname), ("HOME", "/root")] {
        if !env.iter().any(|e| e.starts_with(&format!("{k}="))) {
            env.push(format!("{k}={v}"));
        }
    }
    let path = env.iter().find_map(|e| e.strip_prefix("PATH=")).unwrap_or(DEFAULT_PATH).to_string();
    let workdir = if c.working_dir.is_empty() { "/".to_string() } else { c.working_dir };
    let program = Program { argv: to_cstrings(&words)?, env: Some(to_cstrings(&env)?), path, workdir };
    Ok((RootSpec::Image(img.layers), program))
}

/// "64M", "1G", "512K", "1048576" 을 바이트 수로
fn parse_bytes(s: &str) -> Result<u64, String> {
    let (num, mul) = match s.chars().last() {
        Some('K' | 'k') => (&s[..s.len() - 1], 1 << 10),
        Some('M' | 'm') => (&s[..s.len() - 1], 1 << 20),
        Some('G' | 'g') => (&s[..s.len() - 1], 1 << 30),
        _ => (s, 1),
    };
    num.parse::<u64>().map(|n| n * mul).map_err(|e| format!("{s}: {e}"))
}

fn run(
    hostname: String,
    init: bool,
    root: RootSpec,
    program: Program,
    limits: &Limits,
    userns_base: Option<u32>,
    net: Net,
    dns: Vec<IpAddr>,
    security: Security,
) -> Result<i32> {
    let rootless = !Uid::effective().is_root();
    let idmap = match (rootless, userns_base) {
        (true, Some(_)) => bail!("--userns-base는 root로 실행할 때만 쓸 수 있습니다"),
        (true, None) => Some(IdMap::rootless()),
        (false, Some(base)) => {
            if base.checked_add(USERNS_RANGE - 1).is_none_or(|last| last == u32::MAX) {
                bail!("--userns-base는 0..4294901759 범위여야 합니다 (65536개 ID, UID/GID -1 제외)");
            }
            Some(IdMap::range(base))
        },
        (false, None) => None,
    };
    if rootless && net == Net::Bridge {
        // veth·브리지·iptables는 호스트(최상위) 네트워크 네임스페이스를 바꾸는 일이다
        bail!("--net bridge는 root로 실행할 때만 쓸 수 있습니다");
    }
    let id = std::process::id();
    // 이미지면 컨테이너 전용 overlay 작업 공간. 끝나면 지운다 (docker run --rm 처럼)
    let workspace = match &root {
        RootSpec::Image(_) => Some(Workspace::create(id)?),
        _ => None,
    };
    let resolver = Resolver::prepare(net, &dns)?;
    let root_setup = match &root {
        RootSpec::Dir(dir) => {
            Resolver::target(dir)?;
            RootSetup { target: dir.clone(), resolver: resolver.path.clone(), overlay: None, files: vec![] }
        },
        RootSpec::Image(layers) => {
            let ws = workspace.as_ref().unwrap();
            RootSetup {
                target: ws.merged(),
                resolver: resolver.path.clone(),
                overlay: Some(ws.overlay_options(layers)),
                files: etc_files(&hostname)?,
            }
        }
    };
    let cgroup = if rootless {
        if limits.any() {
            bail!("rootless 모드에서는 --memory/--cpus/--pids를 쓸 수 없습니다 (cgroup 위임이 필요합니다)");
        }
        None
    } else {
        Some(Cgroup::create(&format!("ctr-{id}"), limits)?)
    };

    // O_CLOEXEC: 사용자 프로그램으로 새지 않게
    let (sync_rd, sync_wr) = pipe2(OFlag::O_CLOEXEC).context("pipe")?;
    let cfg = Config {
        hostname, init, program,
        root: root_setup,
        sync: (sync_rd.as_raw_fd(), sync_wr.as_raw_fd()),
        userns: idmap.is_some(),
        // 특권 range 모드에서는 상속한 호스트 보조 그룹을 남기지 않는다.
        // rootless는 setgroups=deny이므로 변경할 수 없다.
        clear_groups: idmap.as_ref().is_some_and(|map| !map.deny_setgroups),
        security,
    };

    let mut flags = CloneFlags::CLONE_NEWUTS | CloneFlags::CLONE_NEWPID | CloneFlags::CLONE_NEWNS;
    if idmap.is_some() {
        flags |= CloneFlags::CLONE_NEWUSER;
    }
    if net != Net::Host {
        flags |= CloneFlags::CLONE_NEWNET;
    }
    let mut stack = vec![0u8; STACK_SIZE];
    let cb = Box::new(|| container_main(&cfg));
    let child = unsafe { clone(cb, &mut stack, flags, Some(Signal::SIGCHLD as i32)) }
        .context("clone 실패")?;
    drop(sync_rd);

    // 준비 실패 시 먼저 파이프를 닫는다. 자식은 EOF를 받고 종료하며,
    // 부모는 반드시 wait로 회수한 뒤 cgroup을 정리한다.
    let mut veth_guard = None;
    let prepared = (|| -> Result<()> {
        if let Some(cg) = &cgroup {
            cg.add(child)?;
        }
        if let Some(map) = &idmap {
            map.write(child)?;
        }
        // 매핑까지 끝난 뒤에 네트워크. 자식은 아직 파이프에서 기다린다
        let ns = NetnsEnter { child, via_userns: rootless };
        match net {
            Net::Host => {}
            Net::None => ns.run(&["ip", "link", "set", "lo", "up"])?,
            Net::Bridge => { veth_guard = Some(setup_bridge_net(&ns, id)?); },
        }
        unsafe { signal(Signal::SIGINT, SigHandler::SigIgn) }
            .context("signal 설정 실패")?;
        write(&sync_wr, &[1]).context("자식 깨우기")?;
        Ok(())
    })();
    drop(sync_wr);
    if let Err(error) = prepared {
        // EOF로 종료한 PID 1을 회수하기 전에 Cgroup::drop이 실행되면
        // cgroup.procs가 비어 있지 않아 정리가 실패할 수 있다.
        wait_exit_code(child).context("준비 실패한 자식 회수")?;
        return Err(error);
    }
    let code = wait_exit_code(child)?;
    if cgroup.as_ref().is_some_and(|cg| cg.oom_kills() > 0) {
        eprintln!("myctr: 메모리 상한을 넘어 OOM killer가 프로세스를 종료했습니다");
    }
    // overlay 마운트는 자식의 마운트 네임스페이스에만 있었으므로 이미 사라졌다.
    // 여기서 cgroup과 작업 공간(upper, work)이 drop되며 지워진다
    Ok(code)
}

/// 컨테이너 하나의 overlay 작업 공간: upper(쓰기), work(overlayfs 내부용), merged(마운트 지점)
struct Workspace {
    dir: PathBuf,
}

impl Workspace {
    fn create(id: u32) -> Result<Self> {
        let dir = Path::new(image::STORE).join("containers").join(format!("ctr-{id}"));
        for sub in ["upper", "work", "merged"] {
            fs::create_dir_all(dir.join(sub)).with_context(|| format!("{} 만들기", dir.display()))?;
        }
        Ok(Workspace { dir })
    }

    fn merged(&self) -> PathBuf {
        self.dir.join("merged")
    }

    /// lowerdir는 위 레이어가 앞에 온다
    fn overlay_options(&self, layers: &[PathBuf]) -> String {
        let lower: Vec<_> = layers.iter().rev().map(|p| p.display().to_string()).collect();
        format!(
            "lowerdir={},upperdir={},workdir={}",
            lower.join(":"),
            self.dir.join("upper").display(),
            self.dir.join("work").display()
        )
    }
}

impl Drop for Workspace {
    fn drop(&mut self) {
        if let Err(e) = fs::remove_dir_all(&self.dir) {
            eprintln!("myctr: 작업 공간 정리 실패 {}: {e}", self.dir.display());
        }
    }
}

/// 이미지 루트에 써 넣을 /etc 파일. overlay의 upper에 기록되므로 이미지는 바뀌지 않는다
fn etc_files(hostname: &str) -> Result<Vec<(PathBuf, String)>> {
    Ok(vec![
        ("/etc/hostname".into(), format!("{hostname}\n")),
        ("/etc/hosts".into(), format!("127.0.0.1\tlocalhost\n::1\tlocalhost\n127.0.1.1\t{hostname}\n")),
    ])
}

fn wait_exit_code(child: Pid) -> Result<i32> {
    loop {
        match waitpid(child, None) {
            Ok(WaitStatus::Exited(_, code)) => return Ok(code),
            Ok(WaitStatus::Signaled(_, sig, _)) => return Ok(128 + sig as i32),
            Ok(other) => bail!("예상하지 못한 상태: {other:?}"),
            Err(Errno::EINTR) => continue,
            Err(error) => return Err(error).context("waitpid 실패"),
        }
    }
}

/// 외부 명령을 실행하고 실패하면 stderr를 에러에 담는다
fn sh(args: &[&str]) -> Result<()> {
    let out = Cmd::new(args[0])
        .args(&args[1..])
        .output()
        .with_context(|| format!("{} 실행", args[0]))?;
    if !out.status.success() {
        bail!("{}: {}", args.join(" "), String::from_utf8_lossy(&out.stderr).trim());
    }
    Ok(())
}

/// 성공 여부만 본다 (규칙이 이미 있는지 확인할 때)
fn sh_ok(args: &[&str]) -> bool {
    Cmd::new(args[0]).args(&args[1..]).output().is_ok_and(|o| o.status.success())
}

/// 자식의 네트워크 네임스페이스 안에서 명령을 실행하는 방법
struct NetnsEnter {
    child: Pid,
    /// rootless: 호스트에서 권한이 없으므로 자식의 user 네임스페이스를 거쳐 들어간다
    via_userns: bool,
}

impl NetnsEnter {
    fn run(&self, args: &[&str]) -> Result<()> {
        let target = self.child.to_string();
        let mut full = vec!["nsenter", "-t", target.as_str()];
        if self.via_userns {
            // 5장의 setgroups=deny 때문에 nsenter가 자격 증명을 바꾸지 않게 한다
            full.extend_from_slice(&["-U", "--preserve-credentials"]);
        }
        full.push("-n");
        full.extend_from_slice(args);
        sh(&full)
    }
}

/// 브리지, 포워딩, NAT. 모든 컨테이너가 공유하므로 없을 때만 만든다
fn ensure_bridge() -> Result<()> {
    if !sh_ok(&["ip", "link", "show", BRIDGE]) {
        sh(&["ip", "link", "add", BRIDGE, "type", "bridge"])?;
        sh(&["ip", "addr", "add", &format!("{GATEWAY}/24"), "dev", BRIDGE])?;
    }
    sh(&["ip", "link", "set", BRIDGE, "up"])?;
    fs::write("/proc/sys/net/ipv4/ip_forward", "1").context("ip_forward 켜기")?;
    let rules: [&[&str]; 3] = [
        &["-t", "nat", "POSTROUTING", "-s", SUBNET, "!", "-o", BRIDGE, "-j", "MASQUERADE"],
        &["-t", "filter", "FORWARD", "-i", BRIDGE, "-j", "ACCEPT"],
        &["-t", "filter", "FORWARD", "-o", BRIDGE, "-m", "conntrack", "--ctstate", "RELATED,ESTABLISHED", "-j", "ACCEPT"],
    ];
    for rule in rules {
        // iptables -t <표> -C <체인> ... 로 있는지 보고, 없으면 -A
        let (table, rest) = rule.split_at(2);
        let mut check = vec!["iptables"];
        check.extend_from_slice(table);
        check.push("-C");
        check.extend_from_slice(rest);
        if !sh_ok(&check) {
            check[3] = "-A";
            sh(&check)?;
        }
    }
    Ok(())
}

struct VethGuard { name: String }
impl Drop for VethGuard {
    fn drop(&mut self) { let _ = sh(&["ip", "link", "del", &self.name]); }
}

fn setup_bridge_net(ns: &NetnsEnter, id: u32) -> Result<VethGuard> {
    ensure_bridge()?;
    // 인터페이스 이름은 15자 제한. 컨테이너 쪽은 옮긴 뒤 eth0으로 바꾼다
    let host_if = format!("veth{id}");
    let peer_if = format!("ceth{id}");
    // 간단한 주소 배정: 10.88.0.2 ~ 10.88.0.254
    let ip = format!("10.88.0.{}/24", 2 + id % 253);

    sh(&["ip", "link", "add", &host_if, "type", "veth", "peer", "name", &peer_if])?;
    let guard = VethGuard { name: host_if.clone() };
    sh(&["ip", "link", "set", &host_if, "master", BRIDGE, "up"])?;
    sh(&["ip", "link", "set", &peer_if, "netns", &ns.child.to_string()])?;

    ns.run(&["ip", "link", "set", "lo", "up"])?;
    ns.run(&["ip", "link", "set", &peer_if, "name", "eth0"])?;
    ns.run(&["ip", "addr", "add", &ip, "dev", "eth0"])?;
    ns.run(&["ip", "link", "set", "eth0", "up"])?;
    ns.run(&["ip", "route", "add", "default", "via", GATEWAY])?;
    Ok(guard)
}

/// 실행마다 별도 resolver 파일. 자식을 회수한 뒤 삭제된다.
struct Resolver { path: PathBuf }
impl Resolver {
    fn prepare(net: Net, dns: &[IpAddr]) -> Result<Self> {
        let content = if dns.is_empty() {
            let text = fs::read_to_string("/etc/resolv.conf").context("호스트 resolver 읽기")?;
            let loopback = text.lines().any(|line| {
                let mut words = line.split_whitespace();
                words.next() == Some("nameserver") && words.next()
                    .and_then(|v| v.parse::<IpAddr>().ok()).is_some_and(|ip| ip.is_loopback())
            });
            if net == Net::Bridge && loopback {
                bail!("호스트 resolver가 loopback입니다. bridge에서 접근 가능한 --dns ADDRESS를 지정하세요");
            }
            text
        } else {
            dns.iter().map(|ip| format!("nameserver {ip}\n")).collect()
        };
        let path = std::env::temp_dir().join(format!("myctr-resolv-{}", std::process::id()));
        let mut file = OpenOptions::new().write(true).create_new(true).mode(0o644).open(&path)
            .context("전용 resolver 파일 만들기")?;
        let resolver = Self { path };
        file.write_all(content.as_bytes()).context("resolver 쓰기")?;
        Ok(resolver)
    }
    fn target(rootfs: &Path) -> Result<()> {
        let target = rootfs.join("etc/resolv.conf");
        match fs::symlink_metadata(&target) {
            Ok(meta) if !meta.is_file() => bail!("rootfs/etc/resolv.conf는 일반 파일이어야 합니다"),
            Ok(_) => {},
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                OpenOptions::new().write(true).create_new(true).open(&target)
                    .context("resolv.conf 마운트 대상 만들기")?;
            },
            Err(error) => return Err(error).context("resolv.conf 대상 확인"),
        }
        Ok(())
    }

}
impl Drop for Resolver {
    fn drop(&mut self) { let _ = fs::remove_file(&self.path); }
}

/// user 네임스페이스의 UID/GID 매핑
struct IdMap {
    uid_map: String,
    gid_map: String,
    /// 비특권 프로세스가 gid_map을 쓰려면 먼저 setgroups를 막아야 한다
    deny_setgroups: bool,
}

impl IdMap {
    /// 컨테이너 root(0) 하나를 나 자신에게
    fn rootless() -> Self {
        IdMap {
            uid_map: format!("0 {} 1", Uid::effective()),
            gid_map: format!("0 {} 1", Gid::effective()),
            deny_setgroups: true,
        }
    }

    /// 컨테이너의 0..65535 를 호스트의 base..base+65535 로
    fn range(base: u32) -> Self {
        IdMap {
            uid_map: format!("0 {base} {USERNS_RANGE}"),
            gid_map: format!("0 {base} {USERNS_RANGE}"),
            deny_setgroups: false,
        }
    }

    fn write(&self, pid: Pid) -> Result<()> {
        let proc = PathBuf::from(format!("/proc/{pid}"));
        if self.deny_setgroups {
            fs::write(proc.join("setgroups"), "deny").context("setgroups 막기")?;
        }
        fs::write(proc.join("uid_map"), &self.uid_map)
            .with_context(|| format!("uid_map 쓰기 ({})", self.uid_map))?;
        fs::write(proc.join("gid_map"), &self.gid_map)
            .with_context(|| format!("gid_map 쓰기 ({})", self.gid_map))?;
        Ok(())
    }
}

struct Cgroup {
    path: PathBuf,
}

impl Cgroup {
    fn create(name: &str, limits: &Limits) -> Result<Self> {
        let parent = Path::new(CGROUP_ROOT).join(CGROUP_PARENT);
        fs::create_dir_all(&parent).with_context(|| format!("{} 만들기", parent.display()))?;
        // 부모에서 컨트롤러를 켜야 자식 cgroup에 memory.max 같은 파일이 생긴다
        fs::write(parent.join("cgroup.subtree_control"), "+memory +cpu +pids")
            .context("컨트롤러 활성화 (상위 cgroup의 cgroup.subtree_control에 memory cpu pids가 켜져 있나요?)")?;

        let path = parent.join(name);
        fs::create_dir(&path).with_context(|| format!("{} 만들기", path.display()))?;
        let cg = Cgroup { path };
        if let Some(bytes) = limits.memory {
            cg.write("memory.max", &bytes.to_string())?;
            // 스왑으로 도망가지 못하게. 스왑 계정이 꺼진 커널에는 파일이 없다
            if cg.path.join("memory.swap.max").exists() {
                cg.write("memory.swap.max", "0")?;
            }
        }
        if let Some(cpus) = limits.cpus {
            let quota = (cpus * CPU_PERIOD_US as f64) as u64;
            cg.write("cpu.max", &format!("{quota} {CPU_PERIOD_US}"))?;
        }
        if let Some(n) = limits.pids {
            cg.write("pids.max", &n.to_string())?;
        }
        Ok(cg)
    }

    fn write(&self, file: &str, value: &str) -> Result<()> {
        fs::write(self.path.join(file), value)
            .with_context(|| format!("{}/{file} 에 {value} 쓰기", self.path.display()))
    }

    /// 프로세스를 이 cgroup으로 옮긴다 (호스트 PID)
    fn add(&self, pid: Pid) -> Result<()> {
        self.write("cgroup.procs", &pid.to_string())
    }

    /// memory.events 의 oom_kill 카운터
    fn oom_kills(&self) -> u64 {
        fs::read_to_string(self.path.join("memory.events"))
            .ok()
            .and_then(|s| {
                s.lines()
                    .find_map(|l| l.strip_prefix("oom_kill ").and_then(|n| n.parse().ok()))
            })
            .unwrap_or(0)
    }
}

impl Drop for Cgroup {
    fn drop(&mut self) {
        // 프로세스가 남아 있으면 EBUSY. PID 1이 끝나면 네임스페이스 전체가 정리되므로 비어 있다
        if let Err(e) = fs::remove_dir(&self.path) {
            eprintln!("myctr: cgroup 정리 실패 {}: {e}", self.path.display());
        }
    }
}

/// clone된 자식. 새 네임스페이스 안의 PID 1이다.
fn container_main(cfg: &Config) -> isize {
    // 부모가 cgroup, ID 매핑, 네트워크를 끝낼 때까지 기다린다.
    // 쓰는 쪽을 닫아 두어야 부모가 죽었을 때 read가 EOF(0)로 깨어난다
    let _ = close(cfg.sync.1);
    let mut buf = [0u8; 1];
    loop {
        match read(cfg.sync.0, &mut buf) {
            Ok(1) => break,
            Err(Errno::EINTR) => continue,
            _ => {
                eprintln!("myctr: 부모가 준비를 마치지 못했습니다");
                return 1;
            }
        }
    }
    let _ = close(cfg.sync.0);

    if let Err(e) = setup(cfg) {
        eprintln!("myctr: {e:#}");
        return 1;
    }
    if cfg.init { mini_init(&cfg.program) } else { exec(&cfg.program) }
}

/// fork와 exec 사이에서 컨테이너의 모양을 만든다
fn setup(cfg: &Config) -> Result<()> {
    if cfg.userns {
        // 매핑은 ID의 대응표만 만든다. 특히 range 모드에서 host UID 0은
        // 매핑 밖이므로, 새 namespace의 ID 0으로 자격 증명을 옮긴다.
        if cfg.clear_groups {
            setgroups(&[]).context("보조 그룹 비우기")?;
        }
        setgid(Gid::from_raw(0)).context("컨테이너 GID 0으로 전환")?;
        setuid(Uid::from_raw(0)).context("컨테이너 UID 0으로 전환")?;
    }
    sethostname(&cfg.hostname).context("sethostname")?;
    setup_root(&cfg.root)?;
    chdir(cfg.program.workdir.as_str())
        .with_context(|| format!("작업 디렉터리 {}", cfg.program.workdir))?;
    // 위의 일들은 권한이 필요하다. 다 끝났으니 마지막으로 권한을 내려놓는다
    lock_down(&cfg.security)
}

/// 새 루트로 갈아탄다 (3장의 순서에 overlay 마운트와 /etc 파일 쓰기를 더한 것)
/// 실습 중 호스트 /를 rootfs로 지정하거나 준비를 빠뜨리는 실수를 막는다.
/// 신뢰하는 Alpine 입력을 전제로 하며 악성 rootfs 검증기는 아니다.
fn validate_rootfs(rootfs: &Path) -> Result<()> {
    if rootfs == Path::new("/") || !rootfs.is_dir() {
        bail!("rootfs는 호스트 /가 아닌 디렉터리여야 합니다");
    }
    if !fs::symlink_metadata(rootfs.join("bin/sh")).is_ok_and(|meta| meta.is_file() || meta.file_type().is_symlink())
        || !rootfs.join("proc").is_dir() || !rootfs.join("dev").is_dir() {
        bail!("rootfs에 bin/sh와 proc·dev 디렉터리를 준비하세요");
    }
    Ok(())
}

fn setup_root(root: &RootSetup) -> Result<()> {
    // 1. 이후의 마운트가 호스트로 전파되지 않도록 모든 마운트를 private으로
    mount(None::<&str>, "/", None::<&str>, MsFlags::MS_REC | MsFlags::MS_PRIVATE, None::<&str>)
        .context("/ 를 rprivate으로 바꾸기")?;

    // 2. 이미지: 레이어 위에 컨테이너 전용 upper를 얹어 merged에 마운트
    if let Some(opts) = &root.overlay {
        mount(Some("overlay"), &root.target, Some("overlay"), MsFlags::empty(), Some(opts.as_str()))
            .context("overlayfs 마운트")?;
    }

    // 3. pivot_root의 new_root는 마운트 지점이어야 하므로 자기 자신에게 bind
    mount(Some(&root.target), &root.target, None::<&str>, MsFlags::MS_BIND | MsFlags::MS_REC, None::<&str>)
        .context("rootfs bind mount")?;

    // 4. 루트를 바꾼다. 이전 루트는 /.oldroot 에 걸린다
    let old_root = root.target.join(OLD_ROOT);
    fs::create_dir_all(&old_root).context(".oldroot 만들기")?;
    pivot_root(&root.target, &old_root).context("pivot_root")?;
    chdir("/").context("chdir /")?;

    // 이미지의 /etc는 실제 디렉터리만 허용한다. oldroot를 통한 경로 우회를 피한다.
    if root.overlay.is_some() {
        match fs::symlink_metadata("/etc") {
            Ok(meta) if !meta.is_dir() => bail!("이미지 /etc는 실제 디렉터리여야 합니다"),
            Ok(_) => {},
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => fs::create_dir("/etc")?,
            Err(error) => return Err(error).context("이미지 /etc 확인"),
        }
        let target = Path::new("/etc/resolv.conf");
        if target.symlink_metadata().is_ok() { fs::remove_file(target)?; }
        File::create(target).context("이미지 resolver 마운트 대상")?;
    }

    // 5. /etc 파일. pivot_root 뒤에 써야 이미지 안의 심볼릭 링크가 호스트 경로로 풀리지 않는다
    for (path, content) in &root.files {
        if let Some(dir) = path.parent() {
            fs::create_dir_all(dir)?;
        }
        let _ = fs::remove_file(path); // 링크였다면 링크 자체를 지운다
        fs::write(path, content).with_context(|| format!("{} 쓰기", path.display()))?;
    }

    // 6. 이 PID 네임스페이스 기준의 procfs
    mount(
        Some("proc"),
        "/proc",
        Some("proc"),
        MsFlags::MS_NOSUID | MsFlags::MS_NODEV | MsFlags::MS_NOEXEC,
        None::<&str>,
    )
    .context("/proc 마운트")?;

    // 7. 최소한의 /dev. 장치 파일은 아직 붙어 있는 이전 루트에서 bind로 빌려 온다
    setup_dev().context("/dev 구성")?;

    let source = format!("/{OLD_ROOT}{}", root.resolver.display());
    mount(Some(source.as_str()), "/etc/resolv.conf", None::<&str>, MsFlags::MS_BIND, None::<&str>)
        .context("전용 resolver bind")?;
    mount(None::<&str>, "/etc/resolv.conf", None::<&str>,
          MsFlags::MS_BIND | MsFlags::MS_REMOUNT | MsFlags::MS_RDONLY, None::<&str>)
        .context("resolver 읽기 전용")?;

    // 8. 이전 루트를 떼어 내고 흔적을 지운다
    let old = format!("/{OLD_ROOT}");
    umount2(old.as_str(), MntFlags::MNT_DETACH).context("이전 루트 분리")?;
    fs::remove_dir(&old).context(".oldroot 지우기")?;
    Ok(())
}

fn setup_dev() -> Result<()> {
    mount(
        Some("tmpfs"),
        "/dev",
        Some("tmpfs"),
        MsFlags::MS_NOSUID | MsFlags::MS_STRICTATIME,
        Some("mode=755,size=65536k"),
    )?;
    for dev in DEVICES {
        let target = format!("/dev/{dev}");
        File::create(&target).with_context(|| format!("{target} 만들기"))?;
        let source = format!("/{OLD_ROOT}/dev/{dev}");
        mount(Some(source.as_str()), target.as_str(), None::<&str>, MsFlags::MS_BIND, None::<&str>)
            .with_context(|| format!("{target} bind"))?;
    }
    for (link, to) in [
        ("/dev/fd", "/proc/self/fd"),
        ("/dev/stdin", "/proc/self/fd/0"),
        ("/dev/stdout", "/proc/self/fd/1"),
        ("/dev/stderr", "/proc/self/fd/2"),
    ] {
        symlink(to, link).with_context(|| format!("{link} 링크"))?;
    }
    Ok(())
}

impl Security {
    fn new(add: &[String], drop: &[String], no_seccomp: bool) -> Result<Self> {
        let mut caps: CapsHashSet = DEFAULT_CAPS.into_iter().collect();
        for name in drop {
            if name.eq_ignore_ascii_case("ALL") {
                caps.clear();
            } else {
                caps.remove(&parse_cap(name)?);
            }
        }
        for name in add {
            caps.insert(parse_cap(name)?);
        }
        let seccomp = if no_seccomp { None } else { Some(seccomp_filter()?) };
        Ok(Security { caps, seccomp })
    }
}

/// "net_admin", "NET_ADMIN", "CAP_NET_ADMIN" 을 모두 받는다
fn parse_cap(name: &str) -> Result<Capability> {
    let upper = name.to_ascii_uppercase();
    let full = if upper.starts_with("CAP_") { upper } else { format!("CAP_{upper}") };
    full.parse().map_err(|_| anyhow!("알 수 없는 capability: {name}"))
}

/// 목록의 시스템 콜은 EPERM, 나머지는 허용하는 BPF 프로그램
fn seccomp_filter() -> Result<BpfProgram> {
    let rules: BTreeMap<i64, Vec<SeccompRule>> =
        BLOCKED_SYSCALLS.iter().map(|&(_, nr)| (nr, vec![])).collect();
    let filter = SeccompFilter::new(
        rules,
        SeccompAction::Allow,                        // 목록에 없으면
        SeccompAction::Errno(libc::EPERM as u32),    // 목록에 있으면
        std::env::consts::ARCH.try_into().context("seccomp 아키텍처")?,
    )
    .context("seccomp 필터 만들기")?;
    filter.try_into().context("seccomp BPF 컴파일")
}

/// exec 직전의 마지막 단계: 권한을 줄이고 시스템 콜을 막는다
fn lock_down(sec: &Security) -> Result<()> {
    // 1. bounding set: exec를 거쳐도 다시 얻을 수 없는 상한
    for cap in caps::runtime::thread_all_supported() {
        if !sec.caps.contains(&cap) {
            caps::drop(None, CapSet::Bounding, cap).with_context(|| format!("bounding에서 {cap} 빼기"))?;
        }
    }
    // 2. 지금 가진 권한도 같은 범위로. inheritable과 ambient는 비운다
    caps::clear(None, CapSet::Inheritable).context("inheritable 비우기")?;
    caps::clear(None, CapSet::Ambient).context("ambient 비우기")?;
    caps::set(None, CapSet::Effective, &sec.caps).context("effective 설정")?;
    caps::set(None, CapSet::Permitted, &sec.caps).context("permitted 설정")?;
    // 3. setuid 비트나 파일 capability로 권한을 다시 얻지 못하게
    prctl::set_no_new_privs().context("no_new_privs")?;
    // 4. 마지막에 seccomp. 이 뒤로는 막힌 시스템 콜을 부를 수 없다
    if let Some(bpf) = &sec.seccomp {
        seccompiler::apply_filter(bpf).context("seccomp 설치")?;
    }
    Ok(())
}

/// 성공하면 돌아오지 않는다. 돌아오면 127.
fn exec(p: &Program) -> isize {
    if let Err(e) = unsafe { signal(Signal::SIGPIPE, SigHandler::SigDfl) } {
        eprintln!("myctr: SIGPIPE 복원 실패: {e}");
        return 1;
    }
    let err = match &p.env {
        // 이미지: 이미지의 PATH로 찾고 이미지의 환경 변수만 넘긴다
        Some(env) => execve(&find_in_path(&p.argv[0], &p.path), &p.argv, env).unwrap_err(),
        // 호스트나 디렉터리 루트: 1장처럼 지금 환경 그대로
        None => execvp(&p.argv[0], &p.argv).unwrap_err(),
    };
    eprintln!("myctr: {}: {err}", p.argv[0].to_string_lossy());
    127
}

/// PATH의 디렉터리에서 실행 파일을 찾는다. 이름에 /가 있거나 못 찾으면 그대로 돌려준다.
/// execvp는 이 프로세스의 (호스트에서 물려받은) PATH를 쓰므로 직접 찾는다
fn find_in_path(name: &CStr, path: &str) -> CString {
    let bytes = name.to_bytes();
    if !bytes.contains(&b'/') {
        for dir in path.split(':').filter(|d| !d.is_empty()) {
            let mut candidate = dir.as_bytes().to_vec();
            candidate.push(b'/');
            candidate.extend_from_slice(bytes);
            let is_file = Path::new(OsStr::from_bytes(&candidate)).is_file();
            if let Ok(c) = CString::new(candidate) {
                if is_file && access(c.as_c_str(), AccessFlags::X_OK).is_ok() {
                    return c;
                }
            }
        }
    }
    name.to_owned()
}

/// PID 1로 남아 명령을 PID 2로 띄우고, 입양된 고아까지 거두다가
/// 명령이 끝나면 그 종료 코드로 끝난다.
fn mini_init(p: &Program) -> isize {
    let main_child = match unsafe { fork() } {
        Ok(ForkResult::Child) => unsafe { libc::_exit(exec(p) as i32) },
        Ok(ForkResult::Parent { child }) => child,
        Err(e) => {
            eprintln!("myctr-init: fork: {e}");
            return 1;
        }
    };
    loop {
        match waitpid(None, None) {
            Ok(WaitStatus::Exited(pid, code)) if pid == main_child => return code as isize,
            Ok(WaitStatus::Signaled(pid, sig, _)) if pid == main_child => return 128 + sig as isize,
            Ok(_) => continue,
            Err(Errno::EINTR) => continue,
            Err(e) => {
                eprintln!("myctr-init: waitpid: {e}");
                return 1;
            }
        }
    }
}
