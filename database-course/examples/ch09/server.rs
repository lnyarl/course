//! PostgreSQL v3 simple-query teaching server. Loopback only; no authentication/TLS.
use std::{
    io::{self, Read, Write},
    net::{TcpListener, TcpStream},
    path::Path,
    sync::{
        Arc, Mutex,
        atomic::{AtomicUsize, Ordering},
    },
    time::Duration,
};
#[allow(dead_code)]
#[path = "../ch08/transactions.rs"]
mod transactions;
use transactions::{
    Transactions,
    wal::engine::{self, AccessMode, SqlCell, SqlReply, SqlType},
};
const MAX_MESSAGE: usize = 65536;
const MAX_REPLY: usize = 8 * 1024 * 1024;
fn bad(s: &str) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidInput, s)
}
fn frame(out: &mut Vec<u8>, kind: u8, payload: &[u8]) {
    out.push(kind);
    out.extend_from_slice(&((payload.len() + 4) as u32).to_be_bytes());
    out.extend_from_slice(payload);
}
fn cstr(out: &mut Vec<u8>, s: &str) {
    out.extend_from_slice(s.as_bytes());
    out.push(0);
}
fn error(out: &mut Vec<u8>, message: &str) {
    let code = if message.starts_with("serialization conflict:") {
        "40001"
    } else if message.starts_with("database requires recovery") {
        "40003"
    } else if message == "transaction is failed; ROLLBACK required" {
        "25P02"
    } else {
        "42601"
    };
    let mut p = vec![b'S'];
    cstr(&mut p, "ERROR");
    p.push(b'C');
    cstr(&mut p, code);
    p.push(b'M');
    cstr(&mut p, &message.replace('\0', "?"));
    p.push(0);
    frame(out, b'E', &p);
}
fn encode(reply: &SqlReply) -> io::Result<Vec<u8>> {
    let mut out = Vec::new();
    if !reply.columns.is_empty() {
        let mut p = Vec::new();
        p.extend_from_slice(&(reply.columns.len() as u16).to_be_bytes());
        for c in &reply.columns {
            if c.name.contains('\0') {
                return Err(bad("NUL in column name"));
            }
            cstr(&mut p, &c.name);
            p.extend_from_slice(&0u32.to_be_bytes());
            p.extend_from_slice(&0u16.to_be_bytes());
            p.extend_from_slice(&(if c.kind == SqlType::Int { 20u32 } else { 25 }).to_be_bytes());
            p.extend_from_slice(&(if c.kind == SqlType::Int { 8i16 } else { -1 }).to_be_bytes());
            p.extend_from_slice(&(-1i32).to_be_bytes());
            p.extend_from_slice(&0u16.to_be_bytes());
        }
        frame(&mut out, b'T', &p);
        for row in &reply.rows {
            let mut p = Vec::new();
            p.extend_from_slice(&(row.len() as u16).to_be_bytes());
            for c in row {
                let s = match c {
                    SqlCell::Null => {
                        p.extend_from_slice(&(-1i32).to_be_bytes());
                        continue;
                    }
                    SqlCell::Int(v) => v.to_string(),
                    SqlCell::Text(v) => v.clone(),
                };
                if s.contains('\0') {
                    return Err(bad("NUL text cannot be sent through libpq text format"));
                }
                p.extend_from_slice(&(s.len() as u32).to_be_bytes());
                p.extend_from_slice(s.as_bytes());
            }
            frame(&mut out, b'D', &p);
            if out.len() > MAX_REPLY {
                return Err(bad("result exceeds 8 MiB wire limit"));
            }
        }
    }
    let mut p = Vec::new();
    cstr(&mut p, &reply.tag);
    frame(&mut out, b'C', &p);
    Ok(out)
}
fn command(tag: &str) -> SqlReply {
    SqlReply {
        columns: vec![],
        rows: vec![],
        tag: tag.into(),
        json: format!("{{\"command\":\"{tag}\"}}"),
    }
}
fn words_prefix<'a>(s: &'a str, keyword: &str) -> Option<&'a str> {
    let s = s.trim_start();
    if s.len() >= keyword.len()
        && s.get(..keyword.len())
            .is_some_and(|head| head.eq_ignore_ascii_case(keyword))
        && s[keyword.len()..].starts_with(char::is_whitespace)
    {
        Some(s[keyword.len()..].trim_start())
    } else {
        None
    }
}
fn query(manager: &mut Transactions, tx: &mut Option<u64>, sql: &str) -> io::Result<Vec<u8>> {
    let control = sql
        .trim()
        .strip_suffix(';')
        .unwrap_or(sql.trim())
        .trim()
        .to_ascii_uppercase();
    let result = (|| {
        match control.as_str() {
            "BEGIN" => {
                if tx.is_some() {
                    return Err(bad("transaction already active"));
                }
                *tx = Some(manager.begin()?);
                return encode(&command("BEGIN"));
            }
            "COMMIT" => {
                if let Some(id) = *tx {
                    manager.commit(id)?;
                    *tx = None;
                }
                return encode(&command("COMMIT"));
            }
            "ROLLBACK" => {
                if let Some(id) = tx.take() {
                    manager.rollback(id)?;
                }
                return encode(&command("ROLLBACK"));
            }
            "" => {
                let mut out = vec![];
                frame(&mut out, b'I', &[]);
                return Ok(out);
            }
            _ => {}
        }
        let (inner, explain, analyze) = if let Some(rest) = words_prefix(sql, "EXPLAIN") {
            if let Some(rest) = words_prefix(rest, "ANALYZE") {
                (rest, true, true)
            } else {
                (rest, true, false)
            }
        } else {
            (sql, false, false)
        };
        // Snapshot::query_with validates the complete inner statement before the callback.
        let runner = |path: &Path, statement: &str| {
            let reply = if explain {
                engine::explain(path, statement, analyze)?
            } else {
                engine::run_optimized(path, statement)?
            };
            encode(&reply)
        };
        if let Some(id) = *tx {
            manager.query_with(id, inner, runner)
        } else {
            manager.autocommit_with(inner, runner)
        }
    })();
    if result.is_err() {
        if let Some(id) = *tx {
            let _ = manager.mark_failed(id);
        }
    }
    result
}
fn read_length(stream: &mut TcpStream) -> io::Result<usize> {
    let mut b = [0; 4];
    stream.read_exact(&mut b)?;
    let n = u32::from_be_bytes(b) as usize;
    if !(4..=MAX_MESSAGE).contains(&n) {
        return Err(bad("message length outside 4..65536"));
    }
    Ok(n - 4)
}
fn startup(stream: &mut TcpStream) -> io::Result<()> {
    for _ in 0..3 {
        let len = read_length(stream)?;
        let mut p = vec![0; len];
        stream.read_exact(&mut p)?;
        if p.len() < 4 {
            return Err(bad("short startup"));
        }
        let code = u32::from_be_bytes(p[..4].try_into().unwrap());
        if code == 80877103 || code == 80877104 {
            if p.len() != 4 {
                return Err(bad("invalid negotiation"));
            }
            stream.write_all(b"N")?;
            continue;
        }
        if code != 196608 {
            return Err(bad("only PostgreSQL protocol 3.0 supported"));
        }
        if p.last() != Some(&0) {
            return Err(bad("unterminated startup"));
        }
        let fields = p[4..].split(|b| *b == 0).collect::<Vec<_>>();
        if fields.len() < 2 || !fields[fields.len() - 2].is_empty() || (fields.len() - 2) % 2 != 0 {
            return Err(bad("invalid startup key/value pairs"));
        }
        for pair in fields[..fields.len() - 2].chunks(2) {
            let key = std::str::from_utf8(pair[0]).map_err(|_| bad("startup UTF-8"))?;
            let value = std::str::from_utf8(pair[1]).map_err(|_| bad("startup UTF-8"))?;
            if key == "client_encoding"
                && !value.eq_ignore_ascii_case("UTF8")
                && !value.eq_ignore_ascii_case("UTF-8")
            {
                return Err(bad("UTF8 client encoding required"));
            }
        }
        let mut out = vec![];
        frame(&mut out, b'R', &0u32.to_be_bytes());
        for (k, v) in [
            ("server_version", "16.0"),
            ("client_encoding", "UTF8"),
            ("server_encoding", "UTF8"),
            ("standard_conforming_strings", "on"),
            ("integer_datetimes", "on"),
        ] {
            let mut p = vec![];
            cstr(&mut p, k);
            cstr(&mut p, v);
            frame(&mut out, b'S', &p);
        }
        frame(&mut out, b'Z', b"I");
        stream.write_all(&out)?;
        return Ok(());
    }
    Err(bad("too many startup negotiations"))
}
struct Session {
    manager: Arc<Mutex<Transactions>>,
    tx: Option<u64>,
}
impl Drop for Session {
    fn drop(&mut self) {
        if let Some(id) = self.tx.take() {
            if let Ok(mut m) = self.manager.lock() {
                let _ = m.rollback(id);
            }
        }
    }
}
fn serve_client(mut stream: TcpStream, manager: Arc<Mutex<Transactions>>) -> io::Result<()> {
    stream.set_read_timeout(Some(Duration::from_secs(30)))?;
    stream.set_write_timeout(Some(Duration::from_secs(30)))?;
    startup(&mut stream)?;
    let mut session = Session { manager, tx: None };
    loop {
        let mut kind = [0];
        match stream.read_exact(&mut kind) {
            Ok(()) => {}
            Err(e) if e.kind() == io::ErrorKind::UnexpectedEof => return Ok(()),
            Err(e) => return Err(e),
        }
        let len = read_length(&mut stream)?;
        let mut p = vec![0; len];
        stream.read_exact(&mut p)?;
        if kind[0] == b'X' {
            if !p.is_empty() {
                return Err(bad("invalid Terminate"));
            }
            return Ok(());
        }
        if kind[0] != b'Q' {
            let mut out = vec![];
            error(
                &mut out,
                "only simple Query is supported; extended protocol closes connection",
            );
            stream.write_all(&out)?;
            return Ok(());
        }
        let mut out = vec![];
        {
            let mut m = session
                .manager
                .lock()
                .map_err(|_| bad("database mutex poisoned"))?;
            let result = if p.last() != Some(&0) || p[..p.len().saturating_sub(1)].contains(&0) {
                Err(bad("Query requires exactly one trailing NUL"))
            } else {
                std::str::from_utf8(&p[..p.len() - 1])
                    .map_err(|_| bad("Query requires UTF-8"))
                    .and_then(|s| query(&mut m, &mut session.tx, s))
            };
            match result {
                Ok(reply) => out = reply,
                Err(e) => {
                    if let Some(id) = session.tx {
                        let _ = m.mark_failed(id);
                    }
                    error(&mut out, &e.to_string());
                }
            }
            let status = session.tx.and_then(|id| m.status(id)).unwrap_or('I');
            frame(&mut out, b'Z', &[status as u8]);
        }
        stream.write_all(&out)?;
    }
}
struct Permit(Arc<AtomicUsize>);
impl Drop for Permit {
    fn drop(&mut self) {
        self.0.fetch_sub(1, Ordering::SeqCst);
    }
}
const MAX_SQL_BYTES: usize = 16 * 1024;
fn read_sql(input: impl Read) -> io::Result<String> {
    let mut bytes = Vec::new();
    input
        .take((MAX_SQL_BYTES + 1) as u64)
        .read_to_end(&mut bytes)?;
    if bytes.len() > MAX_SQL_BYTES {
        return Err(bad("SQL exceeds 16384 bytes"));
    }
    String::from_utf8(bytes).map_err(|_| bad("SQL requires UTF-8"))
}
fn main() -> io::Result<()> {
    let args = std::env::args().skip(1).collect::<Vec<_>>();
    if args.len() < 2 {
        return Err(bad(
            "usage: server serve DIRECTORY [127.0.0.1:55432] | server sql DIRECTORY [--seq|--index]",
        ));
    }
    if args[0] == "serve" {
        let addr = args
            .get(2)
            .map(String::as_str)
            .unwrap_or("127.0.0.1:55432")
            .parse::<std::net::SocketAddr>()
            .map_err(|_| bad("numeric socket address required"))?;
        if !addr.ip().is_loopback() {
            return Err(bad("loopback binding required"));
        }
        let manager = Arc::new(Mutex::new(Transactions::open(Path::new(&args[1]))?));
        let listener = TcpListener::bind(addr)?;
        println!("LISTEN {}", listener.local_addr()?);
        io::stdout().flush()?;
        let active = Arc::new(AtomicUsize::new(0));
        for incoming in listener.incoming() {
            let stream = incoming?;
            if active.fetch_add(1, Ordering::SeqCst) >= 16 {
                active.fetch_sub(1, Ordering::SeqCst);
                drop(stream);
                continue;
            }
            let permit = Permit(active.clone());
            let m = manager.clone();
            std::thread::spawn(move || {
                let _permit = permit;
                if let Err(e) = serve_client(stream, m) {
                    eprintln!("session: {e}");
                }
            });
        }
        Ok(())
    } else if args[0] == "sql" {
        let sql = read_sql(io::stdin().lock())?;
        let mut m = Transactions::open(Path::new(&args[1]))?;
        let mode = match args.get(2).map(String::as_str) {
            None => AccessMode::Auto,
            Some("--seq") => AccessMode::Sequential,
            Some("--index") => AccessMode::ForceIndex,
            _ => return Err(bad("unknown access mode")),
        };
        let reply = m.autocommit_with(&sql, |p, s| engine::run_mode(p, s, mode))?;
        println!("{}", reply.json);
        Ok(())
    } else {
        Err(bad("unknown command"))
    }
}
#[cfg(test)]
mod wire_tests {
    use super::*;
    #[test]
    fn cli_sql_reader_is_bounded_before_parsing() {
        let mut input = io::Cursor::new(vec![b' '; 1024 * 1024]);
        assert!(
            read_sql(&mut input)
                .unwrap_err()
                .to_string()
                .contains("16384")
        );
        assert_eq!(input.position(), (MAX_SQL_BYTES + 1) as u64);
        assert!(read_sql(io::repeat(b' ')).is_err());
        assert_eq!(
            read_sql(io::Cursor::new(vec![b' '; MAX_SQL_BYTES]))
                .unwrap()
                .len(),
            MAX_SQL_BYTES
        );
        assert!(read_sql(io::Cursor::new(vec![0xff])).is_err());
        assert_eq!(
            read_sql("SELECT '한글'".as_bytes()).unwrap(),
            "SELECT '한글'"
        );
    }
    #[test]
    fn user_identifiers_cannot_choose_transaction_sqlstate() {
        for message in ["unknown column: conflict", "unknown column: recovery"] {
            let mut out = vec![];
            error(&mut out, message);
            assert!(out.windows(6).any(|bytes| bytes == b"42601\0"));
        }
    }
    #[test]
    fn recovery_error_reports_unknown_completion() {
        let mut out = vec![];
        error(
            &mut out,
            "database requires recovery; commit outcome unknown: install failed",
        );
        assert!(out.windows(6).any(|bytes| bytes == b"40003\0"));
    }
    #[test]
    fn frame_big_endian() {
        let mut b = vec![];
        frame(&mut b, b'Z', b"I");
        assert_eq!(b, b"Z\0\0\0\x05I");
    }
    #[test]
    fn null_and_empty_differ() {
        let r = SqlReply {
            columns: vec![engine::SqlColumn {
                name: "v".into(),
                kind: SqlType::Text,
            }],
            rows: vec![vec![SqlCell::Null], vec![SqlCell::Text("".into())]],
            tag: "SELECT 2".into(),
            json: String::new(),
        };
        let b = encode(&r).unwrap();
        assert!(b.windows(6).any(|s| s == [0, 1, 255, 255, 255, 255]));
        assert!(b.windows(6).any(|s| s == [0, 1, 0, 0, 0, 0]));
    }
    #[test]
    fn reject_nul_text() {
        let r = SqlReply {
            columns: vec![engine::SqlColumn {
                name: "v".into(),
                kind: SqlType::Text,
            }],
            rows: vec![vec![SqlCell::Text("a\0b".into())]],
            tag: "SELECT 1".into(),
            json: String::new(),
        };
        assert!(encode(&r).is_err());
    }
    #[test]
    fn unicode_prefix_does_not_panic() {
        assert!(words_prefix("선택가나", "EXPLAIN").is_none());
    }
}
