//! mydb 1장: 로그 구조 키-값 저장소 (Bitcask 방식)
//!
//! 레코드 = crc32(4) | key_len(4) | val_len(4) | key | value   (정수는 리틀 엔디언)
//! 쓰기는 항상 파일 끝에 덧붙이고, 메모리의 색인에는 키마다 최신 레코드의 위치만 둔다.

use std::collections::HashMap;
use std::fs::{self, File, OpenOptions};
use std::io::{self, BufWriter, IsTerminal, Write};
use std::os::unix::fs::FileExt;
use std::path::{Path, PathBuf};

use anyhow::{Context, Result, bail};

/// 레코드 머리: crc32 + key_len + val_len
const HEADER: usize = 12;
/// val_len 자리에 이 값이 오면 삭제 표시(tombstone)
const TOMBSTONE: u32 = u32::MAX;

struct Db {
    path: PathBuf,
    file: File,
    /// 키 → 그 키의 최신 레코드가 시작하는 위치 (Bitcask의 keydir)
    index: HashMap<Vec<u8>, u64>,
    /// 파일 끝 = 다음 레코드를 쓸 위치
    end: u64,
}

/// 레코드 하나를 바이트로. value가 None이면 삭제 표시
fn encode(key: &[u8], value: Option<&[u8]>) -> Vec<u8> {
    let vlen = value.map_or(TOMBSTONE, |v| v.len() as u32);
    let mut body = Vec::with_capacity(8 + key.len() + value.map_or(0, <[u8]>::len));
    body.extend_from_slice(&(key.len() as u32).to_le_bytes());
    body.extend_from_slice(&vlen.to_le_bytes());
    body.extend_from_slice(key);
    if let Some(v) = value {
        body.extend_from_slice(v);
    }
    // crc는 머리의 길이 필드부터 값 끝까지를 덮는다
    let mut record = crc32fast::hash(&body).to_le_bytes().to_vec();
    record.extend_from_slice(&body);
    record
}

/// 버퍼 맨 앞의 레코드 하나: (키, 값 또는 삭제 표시, 레코드 전체 길이).
/// 덜 쓰였거나 crc가 맞지 않으면 None
fn decode(buf: &[u8]) -> Option<(Vec<u8>, Option<Vec<u8>>, usize)> {
    if buf.len() < HEADER {
        return None;
    }
    let u32_at = |i: usize| u32::from_le_bytes(buf[i..i + 4].try_into().unwrap());
    let (crc, klen, vlen) = (u32_at(0), u32_at(4) as usize, u32_at(8));
    let value_len = if vlen == TOMBSTONE { 0 } else { vlen as usize };
    let total = HEADER + klen + value_len;
    if buf.len() < total || crc32fast::hash(&buf[4..total]) != crc {
        return None;
    }
    let key = buf[HEADER..HEADER + klen].to_vec();
    let value = (vlen != TOMBSTONE).then(|| buf[HEADER + klen..total].to_vec());
    Some((key, value, total))
}

impl Db {
    /// 로그를 처음부터 다시 읽어(replay) 색인을 만든다
    fn open(path: &Path) -> Result<Db> {
        let file = OpenOptions::new()
            .read(true)
            .append(true)
            .create(true)
            .open(path)
            .with_context(|| format!("{} 열기", path.display()))?;
        let data = fs::read(path)?;
        let mut index = HashMap::new();
        let mut pos = 0;
        while let Some((key, value, len)) = decode(&data[pos..]) {
            match value {
                Some(_) => index.insert(key, pos as u64),
                None => index.remove(&key),
            };
            pos += len;
        }
        if pos < data.len() {
            // 마지막 쓰기가 끝나지 못하고 꺼진 흔적. 그 뒤로는 믿을 수 없으니 잘라 낸다
            eprintln!("mydb: 깨진 꼬리 {}바이트를 잘라 냅니다 (위치 {pos})", data.len() - pos);
            file.set_len(pos as u64)?;
        }
        Ok(Db { path: path.to_path_buf(), file, index, end: pos as u64 })
    }

    fn append(&mut self, record: &[u8]) -> Result<u64> {
        let at = self.end;
        self.file.write_all(record)?;
        self.end += record.len() as u64;
        Ok(at)
    }

    fn set(&mut self, key: &[u8], value: &[u8]) -> Result<()> {
        let at = self.append(&encode(key, Some(value)))?;
        self.index.insert(key.to_vec(), at);
        Ok(())
    }

    fn get(&self, key: &[u8]) -> Result<Option<Vec<u8>>> {
        let Some(&at) = self.index.get(key) else { return Ok(None) };
        // 머리를 먼저 읽어 길이를 알고, 레코드 전체를 읽어 crc까지 확인한다
        let mut head = [0u8; HEADER];
        self.file.read_exact_at(&mut head, at)?;
        let klen = u32::from_le_bytes(head[4..8].try_into().unwrap()) as usize;
        let vlen = u32::from_le_bytes(head[8..12].try_into().unwrap()) as usize;
        let mut record = vec![0u8; HEADER + klen + vlen];
        self.file.read_exact_at(&mut record, at)?;
        let (_, value, _) = decode(&record).with_context(|| format!("위치 {at}의 레코드가 깨졌습니다"))?;
        Ok(value)
    }

    /// 지웠으면 true, 없던 키면 false
    fn del(&mut self, key: &[u8]) -> Result<bool> {
        if !self.index.contains_key(key) {
            return Ok(false);
        }
        self.append(&encode(key, None))?;
        self.index.remove(key);
        Ok(true)
    }

    /// 살아 있는 키만 새 파일에 다시 써서 바꿔 끼운다. (이전 크기, 새 크기)
    fn compact(&mut self) -> Result<(u64, u64)> {
        let tmp = self.path.with_extension("compact");
        let mut out = BufWriter::new(File::create(&tmp)?);
        let mut keys: Vec<Vec<u8>> = self.index.keys().cloned().collect();
        keys.sort(); // 키 순서로 쓰면 결과 파일이 결정적이다
        let mut index = HashMap::new();
        let mut pos = 0u64;
        for key in keys {
            let value = self.get(&key)?.context("색인에 있는 키의 값이 없습니다")?;
            let record = encode(&key, Some(&value));
            out.write_all(&record)?;
            index.insert(key, pos);
            pos += record.len() as u64;
        }
        // 새 파일이 디스크에 닿은 뒤에야 바꿔 끼운다. rename은 원자적이다
        out.into_inner()?.sync_all()?;
        fs::rename(&tmp, &self.path)?;
        self.file = OpenOptions::new().read(true).append(true).open(&self.path)?;
        let before = self.end;
        self.index = index;
        self.end = pos;
        Ok((before, pos))
    }
}

/// 명령 한 줄을 실행해 응답을 돌려준다. None이면 종료
fn execute(db: &mut Db, line: &str) -> Result<Option<String>> {
    let mut parts = line.trim_start().splitn(3, ' ');
    let reply = match (parts.next().unwrap_or(""), parts.next(), parts.next()) {
        ("", None, None) => String::new(),
        ("set", Some(key), Some(value)) => {
            db.set(key.as_bytes(), value.as_bytes())?;
            "OK".to_string()
        }
        ("get", Some(key), None) => match db.get(key.as_bytes())? {
            Some(v) => String::from_utf8_lossy(&v).into_owned(),
            None => "(nil)".to_string(),
        },
        ("del", Some(key), None) => (if db.del(key.as_bytes())? { "1" } else { "0" }).to_string(),
        ("count", None, None) => db.index.len().to_string(),
        ("compact", None, None) => {
            let (before, after) = db.compact()?;
            format!("{before} → {after} 바이트")
        }
        (".exit", None, None) => return Ok(None),
        _ => bail!("알 수 없는 명령 (set KEY VALUE | get KEY | del KEY | count | compact | .exit)"),
    };
    Ok(Some(reply))
}

fn main() -> Result<()> {
    let path = std::env::args().nth(1).unwrap_or_else(|| "mydb.log".to_string());
    let mut db = Db::open(Path::new(&path))?;
    let stdin = io::stdin();
    let interactive = stdin.is_terminal();
    let mut out = io::stdout().lock();
    let mut line = String::new();
    loop {
        if interactive {
            write!(out, "mydb> ")?;
            out.flush()?;
        }
        line.clear();
        if stdin.read_line(&mut line)? == 0 {
            break; // 입력 끝 (Ctrl+D)
        }
        match execute(&mut db, line.trim_end_matches(['\n', '\r'])) {
            Ok(Some(reply)) if reply.is_empty() => {}
            Ok(Some(reply)) => writeln!(out, "{reply}")?,
            Ok(None) => break,
            Err(e) => writeln!(out, "에러: {e:#}")?,
        }
    }
    Ok(())
}