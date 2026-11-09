//! Bounded whole-file REDO afterimages, private workspaces, one cooperating writer.
//! This is a teaching WAL, not page-LSN/ARIES, and does not make external writers safe.
#[path = "../engine.rs"]
pub mod engine;
use std::{
    collections::BTreeMap,
    fs::{self, File, OpenOptions},
    io::{self, Read, Write},
    os::fd::AsRawFd,
    os::unix::fs::{MetadataExt, OpenOptionsExt},
    path::{Path, PathBuf},
    sync::atomic::{AtomicU64, Ordering},
};
const MAGIC: &[u8; 8] = b"MYWAL07\0";
const HEADER: usize = 20;
const MAX_FILE: usize = 16 * 1024 * 1024;
const MAX_TOTAL: usize = 64 * 1024 * 1024;
const WAL: &str = "wal.log";
const LOCK: &str = ".wal.lock";
const MARKER: &str = ".wal-owner";
static SEQUENCE: AtomicU64 = AtomicU64::new(1);
#[cfg(target_os = "macos")]
const NOFOLLOW: i32 = 0x100;
#[cfg(not(target_os = "macos"))]
const NOFOLLOW: i32 = 0x20000;
unsafe extern "C" {
    fn flock(fd: i32, operation: i32) -> i32;
}
fn bad(message: &str) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidData, message)
}
fn unique() -> String {
    format!(
        "{}-{}",
        std::process::id(),
        SEQUENCE.fetch_add(1, Ordering::Relaxed)
    )
}
fn regular(path: &Path) -> io::Result<()> {
    let m = fs::symlink_metadata(path)?;
    if !m.is_file() || m.file_type().is_symlink() || m.nlink() != 1 {
        return Err(bad("expected private regular file (no symlink/hardlink)"));
    }
    Ok(())
}
fn open_read(path: &Path) -> io::Result<File> {
    regular(path)?;
    OpenOptions::new()
        .read(true)
        .custom_flags(NOFOLLOW)
        .open(path)
}
fn bounded_read(path: &Path, limit: usize) -> io::Result<Vec<u8>> {
    let file = open_read(path)?;
    if file.metadata()?.len() > limit as u64 {
        return Err(bad("file size limit exceeded"));
    }
    let mut b = vec![];
    file.take((limit + 1) as u64).read_to_end(&mut b)?;
    if b.len() > limit {
        return Err(bad("file grew beyond limit"));
    }
    Ok(b)
}
fn sync_dir(path: &Path) -> io::Result<()> {
    File::open(path)?.sync_all()
}
fn valid_data_name(name: &str) -> bool {
    if name == "tables.pages" {
        return true;
    }
    let Some(table) = name.strip_suffix(".idx") else {
        return false;
    };
    !table.is_empty()
        && table.len() <= 32
        && table.as_bytes()[0].is_ascii_alphabetic()
        && table
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'_')
}
fn images(dir: &Path) -> io::Result<BTreeMap<String, Vec<u8>>> {
    let mut out = BTreeMap::new();
    let mut total = 0usize;
    for item in fs::read_dir(dir)? {
        let item = item?;
        let name = item
            .file_name()
            .into_string()
            .map_err(|_| bad("non-UTF8 database file name"))?;
        let kind = item.file_type()?;
        if kind.is_symlink() {
            return Err(bad("symlinks are not database files"));
        }
        if name == WAL
            || name == LOCK
            || name == MARKER
            || name.starts_with(".wal-work-")
            || name.starts_with(".wal-install-")
            || name.starts_with(".wal-checkpoint-")
        {
            continue;
        }
        if !valid_data_name(&name) || !kind.is_file() {
            return Err(bad("unrecognized file in database directory"));
        }
        let b = bounded_read(&item.path(), MAX_FILE)?;
        total = total
            .checked_add(b.len())
            .ok_or_else(|| bad("database size overflow"))?;
        if total > MAX_TOTAL {
            return Err(bad("database exceeds 64 MiB"));
        }
        out.insert(name, b);
    }
    Ok(out)
}
fn crc32(bytes: &[u8]) -> u32 {
    let mut c = 0xffff_ffffu32;
    for &b in bytes {
        c ^= b as u32;
        for _ in 0..8 {
            c = if c & 1 != 0 {
                0xedb8_8320 ^ (c >> 1)
            } else {
                c >> 1
            };
        }
    }
    !c
}
fn header(revision: u64) -> Vec<u8> {
    let mut b = MAGIC.to_vec();
    b.extend_from_slice(&revision.to_le_bytes());
    let crc = crc32(&b);
    b.extend_from_slice(&crc.to_le_bytes());
    b
}
fn frame(body: &[u8]) -> Vec<u8> {
    let mut b = (body.len() as u32).to_le_bytes().to_vec();
    b.extend_from_slice(&crc32(&b[..4]).to_le_bytes());
    b.extend_from_slice(&crc32(body).to_le_bytes());
    b.extend_from_slice(body);
    b
}
fn record(kind: u8, revision: u64) -> Vec<u8> {
    let mut b = vec![kind];
    b.extend_from_slice(&revision.to_le_bytes());
    b
}
fn transaction(revision: u64, files: &BTreeMap<String, Vec<u8>>) -> io::Result<(Vec<u8>, Vec<u8>)> {
    let mut prefix = frame(&record(1, revision));
    for (name, data) in files {
        if !valid_data_name(name) || data.len() > MAX_FILE {
            return Err(bad("invalid afterimage"));
        }
        let mut b = record(2, revision);
        b.push(name.len() as u8);
        b.extend_from_slice(name.as_bytes());
        b.extend_from_slice(&(data.len() as u32).to_le_bytes());
        b.extend_from_slice(data);
        prefix.extend_from_slice(&frame(&b));
        if prefix.len() + HEADER + 29 > MAX_TOTAL {
            return Err(bad("WAL exceeds 64 MiB"));
        }
    }
    let mut commit = record(3, revision);
    commit.extend_from_slice(&(files.len() as u32).to_le_bytes());
    Ok((prefix, frame(&commit)))
}
#[derive(Debug)]
struct Recovery {
    revision: u64,
    committed: Vec<BTreeMap<String, Vec<u8>>>,
    #[allow(dead_code)]
    valid_end: usize,
}
fn decode_wal(bytes: &[u8]) -> io::Result<Recovery> {
    if bytes.len() < HEADER || &bytes[..8] != MAGIC {
        return Err(bad("invalid WAL header"));
    }
    if crc32(&bytes[..16]) != u32::from_le_bytes(bytes[16..20].try_into().unwrap()) {
        return Err(bad("bad WAL header CRC"));
    }
    let mut revision = u64::from_le_bytes(bytes[8..16].try_into().unwrap());
    let mut committed = vec![];
    let mut pending: Option<(u64, BTreeMap<String, Vec<u8>>)> = None;
    let mut at = HEADER;
    let mut valid_end = HEADER;
    while at < bytes.len() {
        if bytes.len() - at < 12 {
            break;
        }
        let len = u32::from_le_bytes(bytes[at..at + 4].try_into().unwrap()) as usize;
        if crc32(&bytes[at..at + 4])
            != u32::from_le_bytes(bytes[at + 4..at + 8].try_into().unwrap())
        {
            return Err(bad("bad WAL length CRC"));
        }
        if len < 9 || len > MAX_FILE + 64 {
            return Err(bad("invalid WAL frame length"));
        }
        let end = at
            .checked_add(12 + len)
            .ok_or_else(|| bad("WAL frame overflow"))?;
        if end > bytes.len() {
            break;
        }
        let body = &bytes[at + 12..end];
        if crc32(body) != u32::from_le_bytes(bytes[at + 8..at + 12].try_into().unwrap()) {
            return Err(bad("complete WAL frame has bad CRC"));
        }
        let tx = u64::from_le_bytes(body[1..9].try_into().unwrap());
        match body[0] {
            1 => {
                if len != 9 || pending.is_some() || Some(tx) != revision.checked_add(1) {
                    return Err(bad("invalid BEGIN sequence"));
                }
                pending = Some((tx, BTreeMap::new()));
            }
            2 => {
                let Some((active, files)) = &mut pending else {
                    return Err(bad("FILE without BEGIN"));
                };
                if *active != tx || len < 14 {
                    return Err(bad("invalid FILE sequence"));
                }
                let n = body[9] as usize;
                if 10 + n + 4 > body.len() {
                    return Err(bad("short FILE name"));
                }
                let name =
                    std::str::from_utf8(&body[10..10 + n]).map_err(|_| bad("invalid FILE name"))?;
                if !valid_data_name(name)
                    || files
                        .last_key_value()
                        .is_some_and(|(last, _)| last.as_str() >= name)
                {
                    return Err(bad("noncanonical FILE name/order"));
                }
                let size = u32::from_le_bytes(body[10 + n..14 + n].try_into().unwrap()) as usize;
                if size > MAX_FILE || body.len() != 14 + n + size {
                    return Err(bad("invalid FILE size"));
                }
                files.insert(name.to_owned(), body[14 + n..].to_vec());
            }
            3 => {
                let Some((active, files)) = pending.take() else {
                    return Err(bad("COMMIT without BEGIN"));
                };
                if active != tx
                    || len != 13
                    || u32::from_le_bytes(body[9..13].try_into().unwrap()) as usize != files.len()
                {
                    return Err(bad("invalid COMMIT sequence/count"));
                }
                revision = tx;
                committed.push(files);
                valid_end = end;
            }
            _ => return Err(bad("unknown WAL record type")),
        }
        at = end;
    }
    // Incomplete EOF and complete uncommitted records never become published state.
    Ok(Recovery {
        revision,
        committed,
        valid_end,
    })
}
fn crash(point: &str) {
    if std::env::var("MYDB_CRASH_POINT").ok().as_deref() == Some(point) {
        std::process::exit(86);
    }
}
fn atomic_file(dir: &Path, name: &str, data: &[u8], prefix: &str) -> io::Result<()> {
    let target = dir.join(name);
    if target.exists() {
        regular(&target)?;
    }
    let tmp = dir.join(format!("{prefix}{}", unique()));
    let mut f = OpenOptions::new()
        .write(true)
        .create_new(true)
        .custom_flags(NOFOLLOW)
        .open(&tmp)?;
    let result = (|| {
        f.write_all(data)?;
        f.sync_all()?;
        drop(f);
        fs::rename(&tmp, &target)?;
        sync_dir(dir)
    })();
    if result.is_err() {
        let _ = fs::remove_file(&tmp);
    }
    result
}
fn install(dir: &Path, files: &BTreeMap<String, Vec<u8>>, hooks: bool) -> io::Result<()> {
    for (i, (name, data)) in files.iter().enumerate() {
        if !valid_data_name(name) {
            return Err(bad("unsafe installation path"));
        }
        atomic_file(dir, name, data, ".wal-install-")?;
        if hooks && i == 0 {
            crash("during-apply");
        }
    }
    sync_dir(dir)
}
fn checkpoint_file(dir: &Path, revision: u64) -> io::Result<()> {
    atomic_file(dir, WAL, &header(revision), ".wal-checkpoint-")
}
// A prefix alone never grants permission to delete somebody else's directory.
fn workspace_name(name: &str) -> bool {
    let Some(tail) = name.strip_prefix(".wal-work-") else {
        return false;
    };
    let Some((pid, sequence)) = tail.split_once('-') else {
        return false;
    };
    matches!(pid.parse::<u32>(), Ok(n) if n > 0 && n.to_string() == pid)
        && matches!(sequence.parse::<u64>(), Ok(n) if n > 0 && n.to_string() == sequence)
}
fn complete_marker(bytes: &[u8]) -> bool {
    let Some(owner) = bytes.strip_prefix(b"MYDB_WORK07 ") else {
        return false;
    };
    let Ok(owner) = std::str::from_utf8(owner) else {
        return false;
    };
    matches!(owner.parse::<u64>(), Ok(n) if n > 0 && n.to_string() == owner)
}
fn owned_workspace(path: &Path, name: &str, database_uid: u32) -> io::Result<bool> {
    if !workspace_name(name) {
        return Ok(false);
    }
    let metadata = fs::symlink_metadata(path)?;
    if !metadata.is_dir() || metadata.file_type().is_symlink() {
        return Err(bad("workspace is not a private directory"));
    }
    let mut eligible = metadata.uid() == database_uid;
    let mut marker = None;
    for entry in fs::read_dir(path)? {
        let entry = entry?;
        let m = fs::symlink_metadata(entry.path())?;
        if m.file_type().is_symlink() || (m.is_file() && m.nlink() != 1) {
            return Err(bad("workspace contains a symlink/hardlink"));
        }
        let Some(name) = entry.file_name().to_str().map(str::to_owned) else {
            eligible = false;
            continue;
        };
        if !m.is_file() || m.uid() != metadata.uid() {
            eligible = false;
            continue;
        }
        if name == MARKER {
            if m.len() > 128 {
                eligible = false;
                continue;
            }
            marker = Some(bounded_read(&entry.path(), 128)?);
        } else if !valid_data_name(&name) || m.len() > MAX_FILE as u64 {
            eligible = false;
        }
    }
    // An unmarked/partially initialized directory is a possible crash remnant,
    // but not proven owned. Preserve it without blocking committed-WAL recovery.
    Ok(eligible && marker.as_deref().is_some_and(complete_marker))
}
fn clean_workspaces(dir: &Path) -> io::Result<()> {
    let database_uid = fs::symlink_metadata(dir)?.uid();
    for item in fs::read_dir(dir)? {
        let item = item?;
        let name = item.file_name();
        if !name.to_string_lossy().starts_with(".wal-work-") {
            continue;
        }
        if !item.file_type()?.is_dir() {
            return Err(bad("workspace is not an owned directory"));
        }
        let Some(name) = name.to_str() else {
            continue;
        };
        if owned_workspace(&item.path(), name, database_uid)? {
            fs::remove_dir_all(item.path())?;
        }
    }
    Ok(())
}
pub struct Database {
    home: PathBuf,
    _lock: File,
    owner: u64,
    revision: u64,
    poisoned: bool,
}
pub struct Snapshot {
    workspace: PathBuf,
    owner: u64,
    base: u64,
    failed: bool,
    dirty: bool,
    finished: bool,
}
impl Snapshot {
    pub fn base_revision(&self) -> u64 {
        self.base
    }
    pub fn is_failed(&self) -> bool {
        self.failed
    }
    pub fn is_dirty(&self) -> bool {
        self.dirty
    }
    pub fn path(&self) -> &Path {
        &self.workspace
    }
    pub fn query(&mut self, sql: &str) -> io::Result<engine::SqlReply> {
        self.query_with(sql, engine::run_sql)
    }
    pub fn query_with<T, F>(&mut self, sql: &str, callback: F) -> io::Result<T>
    where
        F: FnOnce(&Path, &str) -> io::Result<T>,
    {
        if self.failed || self.finished {
            return Err(bad("snapshot failed or finished"));
        }
        let result = (|| {
            let write = engine::is_write(sql)?;
            let out = callback(&self.workspace, sql)?;
            if write {
                self.dirty = true;
            }
            Ok(out)
        })();
        if result.is_err() {
            self.failed = true;
        }
        result
    }
}
impl Drop for Snapshot {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.workspace);
    }
}
impl Database {
    pub fn open(path: &Path) -> io::Result<Self> {
        fs::create_dir_all(path)?;
        if fs::symlink_metadata(path)?.file_type().is_symlink() {
            return Err(bad("database root cannot be a symlink"));
        }
        let home = fs::canonicalize(path)?;
        let lockpath = home.join(LOCK);
        if lockpath.exists() {
            regular(&lockpath)?;
        }
        let lock = OpenOptions::new()
            .read(true)
            .write(true)
            .create(true)
            .truncate(false)
            .custom_flags(NOFOLLOW)
            .open(lockpath)?;
        // LOCK_EX=2, LOCK_NB=4 on macOS and Linux. Keep this inode for the DB lifetime.
        if unsafe { flock(lock.as_raw_fd(), 2 | 4) } != 0 {
            return Err(io::Error::last_os_error());
        }
        clean_workspaces(&home)?;
        images(&home)?;
        if !home.join(WAL).exists() {
            checkpoint_file(&home, 0)?;
        }
        let log = bounded_read(&home.join(WAL), MAX_TOTAL)?;
        let recovery = decode_wal(&log)?;
        for tx in &recovery.committed {
            install(&home, tx, false)?;
        }
        // Atomic replacement drops uncommitted EOF tail only after committed data is synced.
        checkpoint_file(&home, recovery.revision)?;
        Ok(Self {
            home,
            _lock: lock,
            owner: SEQUENCE.fetch_add(1, Ordering::Relaxed),
            revision: recovery.revision,
            poisoned: false,
        })
    }
    fn healthy(&self) -> io::Result<()> {
        if self.poisoned {
            Err(bad("database poisoned: close and reopen for recovery"))
        } else {
            Ok(())
        }
    }
    pub fn revision(&self) -> u64 {
        self.revision
    }
    pub fn is_poisoned(&self) -> bool {
        self.poisoned
    }
    pub fn snapshot(&mut self) -> io::Result<Snapshot> {
        self.healthy()?;
        let workspace = self.home.join(format!(".wal-work-{}", unique()));
        fs::create_dir(&workspace)?;
        let mut snapshot = Snapshot {
            workspace,
            owner: self.owner,
            base: self.revision,
            failed: false,
            dirty: false,
            finished: false,
        };
        let result = (|| {
            // Publish only a fully written marker. A kill before rename leaves
            // an unproven staging file, which restart preserves rather than deletes.
            atomic_file(
                &snapshot.workspace,
                MARKER,
                format!("MYDB_WORK07 {}", self.owner).as_bytes(),
                ".wal-marker-",
            )?;
            for (name, b) in images(&self.home)? {
                let mut f = OpenOptions::new()
                    .write(true)
                    .create_new(true)
                    .open(snapshot.workspace.join(name))?;
                f.write_all(&b)?;
            }
            Ok(())
        })();
        if let Err(e) = result {
            snapshot.failed = true;
            return Err(e);
        }
        Ok(snapshot)
    }
    pub fn commit(&mut self, snapshot: &mut Snapshot) -> io::Result<u64> {
        self.healthy()?;
        if snapshot.owner != self.owner || snapshot.failed || snapshot.finished {
            snapshot.failed = true;
            return Err(bad("snapshot owner/status mismatch"));
        }
        if !snapshot.dirty {
            snapshot.finished = true;
            return Ok(self.revision);
        }
        if snapshot.base != self.revision {
            snapshot.failed = true;
            return Err(bad("serialization conflict: base revision changed"));
        }
        let prepared = (|| {
            let revision = self
                .revision
                .checked_add(1)
                .ok_or_else(|| bad("revision exhausted"))?;
            let files = images(&snapshot.workspace)?;
            let (prefix, commit) = transaction(revision, &files)?;
            Ok((revision, files, prefix, commit))
        })();
        let (revision, files, prefix, commit) = match prepared {
            Ok(v) => v,
            Err(e) => {
                snapshot.failed = true;
                return Err(e);
            }
        };
        let result = (|| {
            let mut log = OpenOptions::new()
                .append(true)
                .custom_flags(NOFOLLOW)
                .open(self.home.join(WAL))?;
            log.write_all(&prefix)?;
            crash("before-commit-record");
            log.write_all(&commit)?;
            log.sync_all()?;
            self.revision = revision;
            snapshot.finished = true;
            crash("after-wal-sync");
            install(&self.home, &files, true)?;
            crash("after-data-sync");
            checkpoint_file(&self.home, revision)?;
            crash("after-checkpoint");
            Ok(revision)
        })();
        if result.is_err() {
            self.poisoned = true;
            snapshot.failed = true;
        }
        result
    }
    pub fn execute(&mut self, sql: &str) -> io::Result<engine::SqlReply> {
        let mut snapshot = self.snapshot()?;
        let result = snapshot.query(sql)?;
        self.commit(&mut snapshot)?;
        Ok(result)
    }
    pub fn checkpoint(&mut self) -> io::Result<()> {
        self.healthy()?;
        let result = checkpoint_file(&self.home, self.revision);
        if result.is_err() {
            self.poisoned = true;
        }
        result?;
        crash("after-checkpoint");
        Ok(())
    }
}
fn main() -> io::Result<()> {
    let args: Vec<_> = std::env::args().skip(1).collect();
    let Some(path) = args.first() else {
        return Err(bad(
            "usage: wal DIRECTORY [--recover|--checkpoint] < input.sql",
        ));
    };
    let mut db = Database::open(Path::new(path))?;
    if args.get(1).map(String::as_str) == Some("--recover") {
        println!("revision={}", db.revision());
        return Ok(());
    }
    if args.get(1).map(String::as_str) == Some("--checkpoint") {
        db.checkpoint()?;
        println!("revision={}", db.revision());
        return Ok(());
    }
    if args.len() != 1 {
        return Err(bad("unknown option"));
    }
    let mut sql = String::new();
    io::stdin().take(16385).read_to_string(&mut sql)?;
    let reply = db.execute(&sql)?;
    println!("{}", reply.json);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    struct Temp(PathBuf);
    impl Temp {
        fn new() -> Self {
            Self(std::env::temp_dir().join(format!("mydb-wal07-{}", unique())))
        }
        fn db(&self) -> Database {
            Database::open(&self.0).unwrap()
        }
    }
    impl Drop for Temp {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }
    const CREATE: &str = "CREATE TABLE people (id INT NOT NULL, name TEXT NOT NULL, age INT)";
    const INSERT: &str = "INSERT INTO people VALUES (1,'Roy',35)";
    fn seeded(t: &Temp) -> Database {
        let mut db = t.db();
        db.execute(CREATE).unwrap();
        db
    }
    fn count(db: &mut Database) -> usize {
        db.execute("SELECT * FROM people").unwrap().rows.len()
    }
    fn append(dir: &Path, b: &[u8]) {
        let mut f = OpenOptions::new().append(true).open(dir.join(WAL)).unwrap();
        f.write_all(b).unwrap();
        f.sync_all().unwrap();
    }
    #[test]
    fn workspace_no_steal_and_actual_sql_commit() {
        let t = Temp::new();
        let mut db = seeded(&t);
        let before = images(&t.0).unwrap();
        let mut s = db.snapshot().unwrap();
        s.query(INSERT).unwrap();
        assert!(s.is_dirty());
        assert_eq!(images(&t.0).unwrap(), before);
        assert_eq!(s.query("SELECT * FROM people").unwrap().rows.len(), 1);
        assert_eq!(count(&mut db), 0);
        assert_eq!(db.commit(&mut s).unwrap(), 2);
        assert_eq!(count(&mut db), 1);
        assert!(s.query("SELECT * FROM people").is_err());
    }
    #[test]
    fn committed_afterimages_replay_idempotently() {
        let t = Temp::new();
        let mut db = seeded(&t);
        let mut s = db.snapshot().unwrap();
        s.query(INSERT).unwrap();
        let files = images(s.path()).unwrap();
        let (p, c) = transaction(2, &files).unwrap();
        append(&t.0, &p);
        append(&t.0, &c);
        drop(s);
        drop(db);
        let mut db = t.db();
        assert_eq!(db.revision(), 2);
        assert_eq!(count(&mut db), 1);
        db.checkpoint().unwrap();
        drop(db);
        let mut db = t.db();
        assert_eq!(count(&mut db), 1);
        assert_eq!(bounded_read(&t.0.join(WAL), MAX_TOTAL).unwrap(), header(2));
    }
    #[test]
    fn uncommitted_and_partial_eof_do_not_publish() {
        let t = Temp::new();
        let mut db = seeded(&t);
        let mut s = db.snapshot().unwrap();
        s.query(INSERT).unwrap();
        let files = images(s.path()).unwrap();
        let (mut p, c) = transaction(2, &files).unwrap();
        p.extend_from_slice(&c[..7]);
        append(&t.0, &p);
        drop(s);
        drop(db);
        let mut db = t.db();
        assert_eq!(db.revision(), 1);
        assert_eq!(count(&mut db), 0);
        assert_eq!(fs::read(t.0.join(WAL)).unwrap(), header(1));
    }
    #[test]
    fn complete_bad_crc_and_bad_length_fail_closed() {
        let (p, c) = transaction(1, &BTreeMap::new()).unwrap();
        let mut b = header(0);
        b.extend_from_slice(&p);
        b.extend_from_slice(&c);
        let mut bad_body = b.clone();
        *bad_body.last_mut().unwrap() ^= 1;
        assert!(
            decode_wal(&bad_body)
                .unwrap_err()
                .to_string()
                .contains("CRC")
        );
        let mut bad_length = b;
        bad_length[HEADER] ^= 1;
        assert!(
            decode_wal(&bad_length)
                .unwrap_err()
                .to_string()
                .contains("length CRC")
        );
    }
    #[test]
    fn invalid_sequence_count_and_path_are_rejected() {
        let mut b = header(0);
        b.extend_from_slice(&frame(&record(1, 2)));
        assert!(decode_wal(&b).is_err());
        let mut b = header(0);
        b.extend_from_slice(&frame(&record(1, 1)));
        let mut f = record(2, 1);
        let name = b"../x.idx";
        f.push(name.len() as u8);
        f.extend_from_slice(name);
        f.extend_from_slice(&0u32.to_le_bytes());
        b.extend_from_slice(&frame(&f));
        assert!(decode_wal(&b).is_err());
        let mut b = header(0);
        b.extend_from_slice(&frame(&record(1, 1)));
        let mut c = record(3, 1);
        c.extend_from_slice(&1u32.to_le_bytes());
        b.extend_from_slice(&frame(&c));
        assert!(decode_wal(&b).is_err());
    }
    #[test]
    fn status_and_owner_checked_before_wal_mutation() {
        let a = Temp::new();
        let b = Temp::new();
        let mut first = seeded(&a);
        let mut second = seeded(&b);
        let mut s = first.snapshot().unwrap();
        s.query(INSERT).unwrap();
        let before = fs::read(b.0.join(WAL)).unwrap();
        assert!(second.commit(&mut s).is_err());
        assert!(s.is_failed());
        assert_eq!(fs::read(b.0.join(WAL)).unwrap(), before);
        let mut s = first.snapshot().unwrap();
        assert!(s.query("SELECT absent FROM people").is_err());
        assert!(s.is_failed());
        assert!(s.query(INSERT).is_err());
        let before = fs::read(a.0.join(WAL)).unwrap();
        assert!(first.commit(&mut s).is_err());
        assert_eq!(fs::read(a.0.join(WAL)).unwrap(), before);
    }
    #[test]
    fn write_conflict_and_old_readonly_commit() {
        let t = Temp::new();
        let mut db = seeded(&t);
        let mut winner = db.snapshot().unwrap();
        let mut loser = db.snapshot().unwrap();
        let mut reader = db.snapshot().unwrap();
        winner.query(INSERT).unwrap();
        loser
            .query("INSERT INTO people VALUES (2,'Ana',20)")
            .unwrap();
        reader.query("SELECT * FROM people").unwrap();
        db.commit(&mut winner).unwrap();
        let before = fs::read(t.0.join(WAL)).unwrap();
        assert!(db.commit(&mut loser).is_err());
        assert!(loser.is_failed());
        assert_eq!(db.commit(&mut reader).unwrap(), 2);
        assert_eq!(fs::read(t.0.join(WAL)).unwrap(), before);
        assert_eq!(count(&mut db), 1);
    }
    #[test]
    fn callback_and_create_policy_errors_fail_snapshot() {
        let t = Temp::new();
        let mut db = seeded(&t);
        let mut s = db.snapshot().unwrap();
        let result: io::Result<()> =
            s.query_with("SELECT * FROM people", |_, _| Err(bad("callback failed")));
        assert!(result.is_err());
        assert!(s.is_failed());
        let mut s = db.snapshot().unwrap();
        assert!(s.query("CREATE TABLE bad (id TEXT)").is_err());
        assert!(s.is_failed());
        assert_eq!(db.revision(), 1);
    }
    #[test]
    fn size_and_symlink_rejected_before_wal() {
        let t = Temp::new();
        let mut db = seeded(&t);
        let before = fs::read(t.0.join(WAL)).unwrap();
        let mut s = db.snapshot().unwrap();
        s.query_with(INSERT, |path, _| {
            OpenOptions::new()
                .write(true)
                .open(path.join("tables.pages"))?
                .set_len(MAX_FILE as u64 + 1)
        })
        .unwrap();
        assert!(db.commit(&mut s).is_err());
        assert!(!db.is_poisoned());
        assert_eq!(fs::read(t.0.join(WAL)).unwrap(), before);
        let mut s = db.snapshot().unwrap();
        let external = Temp::new();
        fs::create_dir(&external.0).unwrap();
        let sentinel = external.0.join("sentinel");
        fs::write(&sentinel, b"keep").unwrap();
        s.query_with(INSERT, |path, _| {
            std::os::unix::fs::symlink(&sentinel, path.join("evil.idx"))
        })
        .unwrap();
        assert!(db.commit(&mut s).is_err());
        assert_eq!(fs::read(&sentinel).unwrap(), b"keep");
        drop(s);
        let mut linked = db.snapshot().unwrap();
        linked
            .query_with(INSERT, |path, _| {
                fs::hard_link(&sentinel, path.join("evil.idx"))
            })
            .unwrap();
        assert!(db.commit(&mut linked).is_err());
        assert_eq!(fs::read(&sentinel).unwrap(), b"keep");
    }
    #[test]
    fn durable_apply_failure_poison_requires_recovery() {
        let t = Temp::new();
        let mut db = seeded(&t);
        let mut s = db.snapshot().unwrap();
        s.query(INSERT).unwrap();
        fs::remove_file(t.0.join("people.idx")).unwrap();
        fs::create_dir(t.0.join("people.idx")).unwrap();
        assert!(db.commit(&mut s).is_err());
        assert!(db.is_poisoned());
        assert!(db.snapshot().is_err());
        assert!(db.checkpoint().is_err());
        drop(db);
        fs::remove_dir(t.0.join("people.idx")).unwrap();
        let mut db = t.db();
        assert_eq!(count(&mut db), 1);
        assert_eq!(db.revision(), 2);
    }
    #[test]
    fn lock_is_exclusive_and_released_on_drop() {
        let t = Temp::new();
        let db = t.db();
        assert!(Database::open(&t.0).is_err());
        drop(db);
        assert!(Database::open(&t.0).is_ok());
        assert!(t.0.join(LOCK).exists());
    }
    #[test]
    fn baseline_adoption_and_checkpoint_preserve_revision() {
        let t = Temp::new();
        engine::run_sql(&t.0, CREATE).unwrap();
        engine::run_sql(&t.0, INSERT).unwrap();
        let mut db = t.db();
        assert_eq!(db.revision(), 0);
        assert_eq!(count(&mut db), 1);
        db.execute("INSERT INTO people VALUES (2,'Ana',20)")
            .unwrap();
        db.checkpoint().unwrap();
        assert_eq!(fs::read(t.0.join(WAL)).unwrap(), header(1));
    }
    #[test]
    fn crc_reference_and_header_damage() {
        assert_eq!(crc32(b"123456789"), 0xcbf43926);
        let mut b = header(9);
        b[8] ^= 1;
        assert!(decode_wal(&b).is_err());
        let mut log = header(9);
        log.extend_from_slice(&[9, 0, 0]);
        let r = decode_wal(&log).unwrap();
        assert_eq!(r.revision, 9);
        assert_eq!(r.valid_end, HEADER);
    }
}

#[cfg(test)]
mod workspace_restart_tests {
    use super::*;
    struct Temp(PathBuf);
    impl Temp {
        fn new() -> Self {
            Self(std::env::temp_dir().join(format!("mydb-workspace-restart-{}", unique())))
        }
        fn seeded(&self) -> Database {
            let mut db = Database::open(&self.0).unwrap();
            db.execute("CREATE TABLE people(id INT NOT NULL,name TEXT)")
                .unwrap();
            db.execute("INSERT INTO people VALUES(1,'committed')")
                .unwrap();
            db
        }
        fn directory(&self, sequence: u64) -> PathBuf {
            let path = self
                .0
                .join(format!(".wal-work-{}-{sequence}", std::process::id()));
            fs::create_dir(&path).unwrap();
            path
        }
    }
    impl Drop for Temp {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }
    #[test]
    fn unmarked_partial_and_staged_workspaces_do_not_block_recovery() {
        let t = Temp::new();
        drop(t.seeded());
        let empty = t.directory(1001);
        let mut preserved = vec![empty];
        for (i, bytes) in [
            b"".as_slice(),
            b"MYDB_W",
            b"MYDB_WORK07 ",
            b"foreign marker",
        ]
        .into_iter()
        .enumerate()
        {
            let dir = t.directory(1002 + i as u64);
            fs::write(dir.join(MARKER), bytes).unwrap();
            preserved.push(dir);
        }
        let staged = t.directory(1006);
        fs::write(staged.join(".wal-marker-1-2"), b"MYDB_W").unwrap();
        preserved.push(staged);
        let mut recovered = Database::open(&t.0).unwrap();
        assert_eq!(recovered.revision(), 2);
        assert_eq!(
            recovered
                .execute("SELECT name FROM people WHERE id=1")
                .unwrap()
                .rows,
            vec![vec![engine::SqlCell::Text("committed".into())]]
        );
        recovered
            .execute("INSERT INTO people VALUES(2,'after recovery')")
            .unwrap();
        for path in &preserved {
            assert!(path.is_dir(), "unproven directory was deleted: {path:?}");
        }
        drop(recovered);
        assert_eq!(Database::open(&t.0).unwrap().revision(), 3);
    }
    #[test]
    fn complete_owned_orphan_is_removed_but_unknown_content_is_preserved() {
        let t = Temp::new();
        let mut db = t.seeded();
        let snapshot = db.snapshot().unwrap();
        let owned = snapshot.path().to_owned();
        std::mem::forget(snapshot);
        let foreign = t.directory(2001);
        fs::write(foreign.join(MARKER), b"MYDB_WORK07 17").unwrap();
        fs::write(foreign.join("notes.txt"), b"do not delete").unwrap();
        let odd = t.0.join(".wal-work-user-notes");
        fs::create_dir(&odd).unwrap();
        fs::write(odd.join(MARKER), b"MYDB_WORK07 17").unwrap();
        let legacy = t.directory(2002);
        fs::write(legacy.join(MARKER), b"MYDB_WORK07 17").unwrap();
        drop(db);
        let _recovered = Database::open(&t.0).unwrap();
        assert!(!owned.exists());
        assert!(!legacy.exists());
        assert_eq!(
            fs::read(foreign.join("notes.txt")).unwrap(),
            b"do not delete"
        );
        assert!(odd.exists());
    }
    #[test]
    fn cleanup_checks_names_uid_and_never_follows_links() {
        assert!(workspace_name(".wal-work-12-34"));
        for name in [
            ".wal-work-not-mine",
            ".wal-work-0-1",
            ".wal-work-1-0",
            ".wal-work-01-2",
            ".wal-work-1-2-more",
        ] {
            assert!(!workspace_name(name));
        }
        assert!(complete_marker(b"MYDB_WORK07 12"));
        for marker in [
            b"".as_slice(),
            b"MYDB_WORK07 ",
            b"MYDB_WORK07 0",
            b"MYDB_WORK07 12 extra",
        ] {
            assert!(!complete_marker(marker));
        }
        let t = Temp::new();
        drop(t.seeded());
        let dir = t.directory(3001);
        fs::write(dir.join(MARKER), b"MYDB_WORK07 17").unwrap();
        let uid = fs::symlink_metadata(&t.0).unwrap().uid();
        assert!(
            !owned_workspace(
                &dir,
                dir.file_name().unwrap().to_str().unwrap(),
                uid.wrapping_add(1)
            )
            .unwrap()
        );
        let external = Temp::new();
        fs::create_dir_all(&external.0).unwrap();
        let sentinel = external.0.join("sentinel");
        fs::write(&sentinel, b"keep").unwrap();
        fs::remove_file(dir.join(MARKER)).unwrap();
        std::os::unix::fs::symlink(&sentinel, dir.join(MARKER)).unwrap();
        assert!(Database::open(&t.0).is_err());
        assert_eq!(fs::read(&sentinel).unwrap(), b"keep");
        fs::remove_file(dir.join(MARKER)).unwrap();
        fs::write(dir.join(MARKER), b"MYDB_WORK07 17").unwrap();
        fs::hard_link(&sentinel, dir.join("people.idx")).unwrap();
        assert!(Database::open(&t.0).is_err());
        assert_eq!(fs::read(&sentinel).unwrap(), b"keep");
    }
}
