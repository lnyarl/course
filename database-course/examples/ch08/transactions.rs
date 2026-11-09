//! Single-process snapshot transactions. This is global-revision OCC, not row MVCC.
use std::{
    collections::HashMap,
    io::{self, BufRead},
    path::Path,
};
#[allow(dead_code)]
#[path = "../ch07/wal.rs"]
pub mod wal;
const MAX_ACTIVE: usize = 32;
fn bad(message: &str) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidInput, message)
}
struct Active {
    snapshot: wal::Snapshot,
    failed: bool,
}
/// Owns the committed database plus independent workspaces for active sessions.
/// An external mutex must serialize calls when used by a network server.
pub struct Transactions {
    database: wal::Database,
    active: HashMap<u64, Active>,
    next_id: u64,
}
impl Transactions {
    pub fn open(path: &Path) -> io::Result<Self> {
        Ok(Self {
            database: wal::Database::open(path)?,
            active: HashMap::new(),
            next_id: 1,
        })
    }
    fn usable(&mut self) -> io::Result<()> {
        if self.database.is_poisoned() {
            for transaction in self.active.values_mut() {
                transaction.failed = true;
            }
            return Err(bad("database requires recovery before further operations"));
        }
        Ok(())
    }
    pub fn begin(&mut self) -> io::Result<u64> {
        self.usable()?;
        if self.active.len() >= MAX_ACTIVE {
            return Err(bad("at most 32 active transactions"));
        }
        let id = self.next_id;
        let next = id
            .checked_add(1)
            .ok_or_else(|| bad("transaction id exhausted"))?;
        let snapshot = self.database.snapshot()?;
        self.next_id = next;
        self.active.insert(
            id,
            Active {
                snapshot,
                failed: false,
            },
        );
        Ok(id)
    }
    pub fn query(&mut self, id: u64, sql: &str) -> io::Result<wal::engine::SqlReply> {
        self.query_with(id, sql, wal::engine::run_sql)
    }
    /// The callback runs only against this transaction's private workspace.
    /// It must execute the supplied SQL honestly; it is an internal engine hook.
    pub fn query_with<T, F>(&mut self, id: u64, sql: &str, runner: F) -> io::Result<T>
    where
        F: FnOnce(&Path, &str) -> io::Result<T>,
    {
        self.usable()?;
        let transaction = self
            .active
            .get_mut(&id)
            .ok_or_else(|| bad("unknown transaction"))?;
        if transaction.failed || transaction.snapshot.is_failed() {
            transaction.failed = true;
            return Err(bad("transaction is failed; ROLLBACK required"));
        }
        let result = transaction.snapshot.query_with(sql, runner);
        if result.is_err() {
            transaction.failed = true;
        }
        result
    }
    pub fn commit(&mut self, id: u64) -> io::Result<u64> {
        self.usable()?;
        let transaction = self
            .active
            .get_mut(&id)
            .ok_or_else(|| bad("unknown transaction"))?;
        if transaction.failed || transaction.snapshot.is_failed() {
            transaction.failed = true;
            return Err(bad("transaction is failed; ROLLBACK required"));
        }
        let result = self.database.commit(&mut transaction.snapshot);
        match result {
            Ok(revision) => {
                self.active.remove(&id);
                Ok(revision)
            }
            Err(error) => {
                self.active.get_mut(&id).unwrap().failed = true;
                if self.database.is_poisoned() {
                    for transaction in self.active.values_mut() {
                        transaction.failed = true;
                    }
                    return Err(io::Error::new(
                        error.kind(),
                        format!("database requires recovery; commit outcome unknown: {error}"),
                    ));
                }
                Err(error)
            }
        }
    }
    /// Rollback remains available after an in-doubt commit to release workspaces.
    /// It cannot undo a commit record that has already reached durable WAL.
    pub fn rollback(&mut self, id: u64) -> io::Result<()> {
        self.active
            .remove(&id)
            .map(drop)
            .ok_or_else(|| bad("unknown transaction"))
    }
    pub fn autocommit(&mut self, sql: &str) -> io::Result<wal::engine::SqlReply> {
        self.autocommit_with(sql, wal::engine::run_sql)
    }
    pub fn autocommit_with<T, F>(&mut self, sql: &str, runner: F) -> io::Result<T>
    where
        F: FnOnce(&Path, &str) -> io::Result<T>,
    {
        let id = self.begin()?;
        match self.query_with(id, sql, runner) {
            Ok(reply) => match self.commit(id) {
                Ok(_) => Ok(reply),
                Err(error) => {
                    let _ = self.rollback(id);
                    Err(error)
                }
            },
            Err(error) => {
                let _ = self.rollback(id);
                Err(error)
            }
        }
    }
    pub fn status(&self, id: u64) -> Option<char> {
        self.active.get(&id).map(|t| {
            if t.failed || t.snapshot.is_failed() || self.database.is_poisoned() {
                'E'
            } else {
                'T'
            }
        })
    }
    pub fn mark_failed(&mut self, id: u64) -> io::Result<()> {
        let transaction = self
            .active
            .get_mut(&id)
            .ok_or_else(|| bad("unknown transaction"))?;
        transaction.failed = true;
        Ok(())
    }
    pub fn revision(&self) -> u64 {
        self.database.revision()
    }
    pub fn active_count(&self) -> usize {
        self.active.len()
    }
    pub fn checkpoint(&mut self) -> io::Result<()> {
        self.usable()?;
        self.database.checkpoint()
    }
}
fn quote(s: &str) -> String {
    let mut out = String::from("\"");
    for c in s.chars() {
        match c {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            c if c < ' ' => out.push_str(&format!("\\u{:04x}", c as u32)),
            _ => out.push(c),
        }
    }
    out.push('"');
    out
}
fn command(sql: &str) -> &str {
    sql.trim().strip_suffix(';').unwrap_or(sql.trim()).trim()
}
fn run() -> io::Result<()> {
    let path = std::env::args()
        .nth(1)
        .ok_or_else(|| bad("usage: transactions DIRECTORY < one-SQL-per-line.txt"))?;
    let mut transactions = Transactions::open(Path::new(&path))?;
    let mut current = None;
    for line in io::stdin().lock().lines() {
        let line = line?;
        if line.trim().is_empty() {
            continue;
        }
        let cmd = command(&line);
        let result: io::Result<String> = if cmd.eq_ignore_ascii_case("BEGIN") {
            if let Some(id) = current {
                transactions.mark_failed(id)?;
                Err(bad("transaction already active; ROLLBACK required"))
            } else {
                transactions.begin().map(|id|{current=Some(id);format!("{{\"tag\":\"BEGIN\",\"transaction\":{id},\"status\":\"T\",\"revision\":{}}}",transactions.revision())})
            }
        } else if cmd.eq_ignore_ascii_case("COMMIT") {
            if let Some(id) = current {
                transactions.commit(id).map(|revision| {
                    current = None;
                    format!("{{\"tag\":\"COMMIT\",\"status\":\"I\",\"revision\":{revision}}}")
                })
            } else {
                Err(bad("no active transaction"))
            }
        } else if cmd.eq_ignore_ascii_case("ROLLBACK") {
            if let Some(id) = current {
                transactions.rollback(id).map(|()| {
                    current = None;
                    "{\"tag\":\"ROLLBACK\",\"status\":\"I\"}".into()
                })
            } else {
                Err(bad("no active transaction"))
            }
        } else if let Some(id) = current {
            transactions.query(id, &line).map(|reply| reply.json)
        } else {
            transactions.autocommit(&line).map(|reply| reply.json)
        };
        match result {
            Ok(json) => println!("{json}"),
            Err(error) => {
                let status = current
                    .and_then(|id| transactions.status(id))
                    .unwrap_or('I');
                println!(
                    "{{\"error\":{},\"status\":\"{status}\"}}",
                    quote(&error.to_string())
                );
            }
        }
    }
    if let Some(id) = current {
        let _ = transactions.rollback(id);
    }
    Ok(())
}
fn main() {
    if let Err(error) = run() {
        eprintln!("{error}");
        std::process::exit(2);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        path::PathBuf,
        sync::atomic::{AtomicU64, Ordering},
    };
    use wal::engine::SqlCell::{Int as I, Text as S};
    static SEQ: AtomicU64 = AtomicU64::new(0);
    struct Temp(PathBuf);
    impl Temp {
        fn new() -> Self {
            Self(std::env::temp_dir().join(format!(
                "mydb-ch08-{}-{}",
                std::process::id(),
                SEQ.fetch_add(1, Ordering::Relaxed)
            )))
        }
        fn open(&self) -> Transactions {
            Transactions::open(&self.0).unwrap()
        }
    }
    impl Drop for Temp {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }
    fn setup(t: &Temp) -> Transactions {
        let mut tx = t.open();
        tx.autocommit("CREATE TABLE people(id INT NOT NULL,name TEXT)")
            .unwrap();
        tx.autocommit("INSERT INTO people VALUES(1,'Roy')").unwrap();
        tx
    }
    fn top_files(path: &Path) -> Vec<(String, Vec<u8>)> {
        let mut files: Vec<_> = std::fs::read_dir(path)
            .unwrap()
            .map(|e| e.unwrap().path())
            .filter(|p| p.is_file())
            .map(|p| {
                (
                    p.file_name().unwrap().to_string_lossy().into_owned(),
                    std::fs::read(p).unwrap(),
                )
            })
            .collect();
        files.sort_by(|a, b| a.0.cmp(&b.0));
        files
    }
    #[test]
    fn snapshot_reads_are_repeatable_and_no_dirty_reads() {
        let t = Temp::new();
        let mut tx = setup(&t);
        let a = tx.begin().unwrap();
        let b = tx.begin().unwrap();
        tx.query(b, "INSERT INTO people VALUES(2,'Ana')").unwrap();
        assert_eq!(tx.query(a, "SELECT * FROM people").unwrap().rows.len(), 1);
        tx.commit(b).unwrap();
        assert_eq!(tx.query(a, "SELECT * FROM people").unwrap().rows.len(), 1);
        tx.commit(a).unwrap();
        assert_eq!(tx.autocommit("SELECT * FROM people").unwrap().rows.len(), 2);
    }
    #[test]
    fn own_writes_and_rollback_discard() {
        let t = Temp::new();
        let mut tx = setup(&t);
        let id = tx.begin().unwrap();
        tx.query(id, "INSERT INTO people VALUES(2,'Ana')").unwrap();
        assert_eq!(
            tx.query(id, "SELECT name FROM people WHERE id=2")
                .unwrap()
                .rows,
            vec![vec![S("Ana".into())]]
        );
        tx.rollback(id).unwrap();
        assert!(
            tx.autocommit("SELECT * FROM people WHERE id=2")
                .unwrap()
                .rows
                .is_empty()
        );
        assert_eq!(tx.active_count(), 0);
    }
    #[test]
    fn dirty_writer_conflicts_after_any_intervening_write() {
        let t = Temp::new();
        let mut tx = setup(&t);
        let a = tx.begin().unwrap();
        let b = tx.begin().unwrap();
        tx.query(a, "INSERT INTO people VALUES(2,'Ana')").unwrap();
        tx.query(b, "INSERT INTO people VALUES(3,'Bo')").unwrap();
        let revision = tx.commit(a).unwrap();
        assert!(tx.commit(b).is_err());
        assert_eq!(tx.status(b), Some('E'));
        assert_eq!(tx.revision(), revision);
        assert!(tx.query(b, "SELECT * FROM people").is_err());
        assert!(tx.commit(b).is_err());
        tx.rollback(b).unwrap();
        assert!(
            tx.autocommit("SELECT * FROM people WHERE id=3")
                .unwrap()
                .rows
                .is_empty()
        );
    }
    #[test]
    fn read_only_old_snapshot_commit_does_not_change_files_or_revision() {
        let t = Temp::new();
        let mut tx = setup(&t);
        let id = tx.begin().unwrap();
        tx.autocommit("INSERT INTO people VALUES(2,'Ana')").unwrap();
        let revision = tx.revision();
        let before = top_files(&t.0);
        assert_eq!(tx.query(id, "SELECT * FROM people").unwrap().rows.len(), 1);
        assert_eq!(tx.commit(id).unwrap(), revision);
        assert_eq!(tx.revision(), revision);
        assert_eq!(top_files(&t.0), before);
    }
    #[test]
    fn sql_error_requires_rollback_and_cannot_commit_earlier_writes() {
        let t = Temp::new();
        let mut tx = setup(&t);
        let id = tx.begin().unwrap();
        tx.query(id, "INSERT INTO people VALUES(2,'Ana')").unwrap();
        assert!(tx.query(id, "SELECT missing FROM people").is_err());
        assert_eq!(tx.status(id), Some('E'));
        assert!(tx.query(id, "SELECT * FROM people").is_err());
        assert!(tx.commit(id).is_err());
        assert_eq!(tx.active_count(), 1);
        tx.rollback(id).unwrap();
        assert!(
            tx.autocommit("SELECT * FROM people WHERE id=2")
                .unwrap()
                .rows
                .is_empty()
        );
    }
    #[test]
    fn callback_uses_workspace_and_supports_optimized_runner() {
        let t = Temp::new();
        let mut tx = setup(&t);
        let id = tx.begin().unwrap();
        let path = tx
            .query_with(id, "SELECT * FROM people", |path, sql| {
                assert_ne!(path, t.0);
                wal::engine::run_optimized(path, sql)?;
                Ok(path.to_owned())
            })
            .unwrap();
        assert!(path.exists());
        tx.rollback(id).unwrap();
        assert!(!path.exists());
    }
    #[test]
    fn callback_errors_fail_explicit_and_cleanup_autocommit() {
        let t = Temp::new();
        let mut tx = setup(&t);
        let id = tx.begin().unwrap();
        let result: io::Result<()> =
            tx.query_with(id, "SELECT * FROM people", |_, _| Err(bad("runner failed")));
        assert!(result.is_err());
        assert_eq!(tx.status(id), Some('E'));
        tx.rollback(id).unwrap();
        let result: io::Result<()> =
            tx.autocommit_with("SELECT * FROM people", |_, _| Err(bad("runner failed")));
        assert!(result.is_err());
        assert_eq!(tx.active_count(), 0);
    }
    #[test]
    fn autocommit_sql_failure_leaves_no_transaction() {
        let t = Temp::new();
        let mut tx = setup(&t);
        let revision = tx.revision();
        assert!(
            tx.autocommit("INSERT INTO people VALUES(1,'duplicate')")
                .is_err()
        );
        assert_eq!(tx.active_count(), 0);
        assert_eq!(tx.revision(), revision);
        assert_eq!(tx.autocommit("SELECT * FROM people").unwrap().rows.len(), 1);
    }
    #[test]
    fn active_limit_unknown_ids_and_id_reuse_rules() {
        let t = Temp::new();
        let mut tx = setup(&t);
        let mut ids = vec![];
        for _ in 0..MAX_ACTIVE {
            ids.push(tx.begin().unwrap());
        }
        assert!(tx.begin().is_err());
        assert_eq!(tx.active_count(), MAX_ACTIVE);
        for id in &ids {
            tx.rollback(*id).unwrap();
        }
        let next = tx.begin().unwrap();
        assert!(next > *ids.last().unwrap());
        tx.rollback(next).unwrap();
        assert!(tx.query(next, "SELECT * FROM people").is_err());
        assert!(tx.commit(next).is_err());
        assert!(tx.rollback(next).is_err());
    }
    #[test]
    fn successful_commit_cleans_workspace_and_reopens() {
        let t = Temp::new();
        let mut tx = setup(&t);
        let id = tx.begin().unwrap();
        tx.query(id, "INSERT INTO people VALUES(2,'Ana')").unwrap();
        let path = tx
            .query_with(id, "SELECT * FROM people", |path, _| Ok(path.to_owned()))
            .unwrap();
        assert!(path.exists());
        tx.commit(id).unwrap();
        assert!(!path.exists());
        assert_eq!(tx.status(id), None);
        drop(tx);
        let mut tx = t.open();
        assert_eq!(
            tx.autocommit("SELECT id FROM people ORDER BY id")
                .unwrap()
                .rows,
            vec![vec![I(1)], vec![I(2)]]
        );
    }
    #[test]
    fn dropping_manager_rolls_back_all_workspaces() {
        let t = Temp::new();
        let mut tx = setup(&t);
        let id = tx.begin().unwrap();
        tx.query(id, "INSERT INTO people VALUES(2,'Ana')").unwrap();
        let path = tx
            .query_with(id, "SELECT * FROM people", |path, _| Ok(path.to_owned()))
            .unwrap();
        drop(tx);
        assert!(!path.exists());
        let mut tx = t.open();
        assert!(
            tx.autocommit("SELECT * FROM people WHERE id=2")
                .unwrap()
                .rows
                .is_empty()
        );
    }
    #[test]
    fn snapshot_prevents_phantoms_from_interleaved_insert() {
        let t = Temp::new();
        let mut tx = setup(&t);
        let id = tx.begin().unwrap();
        let before = tx
            .query(id, "SELECT * FROM people WHERE id>=1")
            .unwrap()
            .rows;
        tx.autocommit("INSERT INTO people VALUES(9,'phantom')")
            .unwrap();
        assert_eq!(
            tx.query(id, "SELECT * FROM people WHERE id>=1")
                .unwrap()
                .rows,
            before
        );
        tx.commit(id).unwrap();
    }
    #[test]
    fn externally_marked_failure_rejects_query_and_commit() {
        let t = Temp::new();
        let mut tx = setup(&t);
        let id = tx.begin().unwrap();
        tx.mark_failed(id).unwrap();
        assert_eq!(tx.status(id), Some('E'));
        assert!(tx.query(id, "SELECT * FROM people").is_err());
        assert!(tx.commit(id).is_err());
        tx.rollback(id).unwrap();
        assert!(tx.mark_failed(id).is_err());
    }
    #[test]
    fn first_durable_apply_error_reports_unknown_commit_outcome() {
        let t = Temp::new();
        let mut tx = setup(&t);
        let writer = tx.begin().unwrap();
        let observer = tx.begin().unwrap();
        tx.query(writer, "INSERT INTO people VALUES(2,'Ana')")
            .unwrap();
        // Force install to fail after the durable WAL decision without changing
        // the private workspace or its valid afterimages.
        std::fs::remove_file(t.0.join("people.idx")).unwrap();
        std::fs::create_dir(t.0.join("people.idx")).unwrap();
        let error = tx.commit(writer).unwrap_err();
        let message = error.to_string();
        assert!(
            message.starts_with("database requires recovery; commit outcome unknown: "),
            "{message}"
        );
        assert!(message.len() > "database requires recovery; commit outcome unknown: ".len());
        assert_eq!(tx.status(writer), Some('E'));
        assert_eq!(tx.status(observer), Some('E'));
        assert!(tx.begin().is_err());
        assert!(tx.query(observer, "SELECT * FROM people").is_err());
        tx.rollback(writer).unwrap();
        tx.rollback(observer).unwrap();
        drop(tx);
        std::fs::remove_dir(t.0.join("people.idx")).unwrap();
        let mut recovered = t.open();
        assert_eq!(
            recovered
                .autocommit("SELECT name FROM people WHERE id=2")
                .unwrap()
                .rows,
            vec![vec![S("Ana".into())]]
        );
    }
    #[test]
    fn exact_transaction_control_recognition() {
        assert!(command("  bEgIn ; ").eq_ignore_ascii_case("BEGIN"));
        assert_ne!(command("BEGIN; SELECT 1"), "BEGIN");
        assert_ne!(command("BEGIN TRANSACTION"), "BEGIN");
    }
}
