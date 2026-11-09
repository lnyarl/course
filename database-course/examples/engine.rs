//! Shared SQL bridge for Chapters 07-09. Earlier implementations stay the execution core.
#![allow(dead_code)]
include!("ch06/executor.rs");

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SqlType {
    Int,
    Text,
}
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SqlCell {
    Int(i64),
    Text(String),
    Null,
}
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SqlColumn {
    pub name: String,
    pub kind: SqlType,
}
#[derive(Debug, Clone)]
pub struct SqlReply {
    pub columns: Vec<SqlColumn>,
    pub rows: Vec<Vec<SqlCell>>,
    pub tag: String,
    pub json: String,
}
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AccessMode {
    Sequential,
    Auto,
    ForceIndex,
}
#[derive(Debug, Clone)]
pub struct PlanReport {
    pub access: String,
    pub estimated_rows: u64,
    pub estimated_cost: u64,
    pub seq_cost: u64,
    pub index_cost: Option<u64>,
    pub lookup_key: Option<i64>,
    pub reason: String,
}
fn sql_cell(v: &Datum) -> SqlCell {
    match v {
        Datum::Int(n) => SqlCell::Int(*n),
        Datum::Text(s) => SqlCell::Text(s.clone()),
        Datum::Null => SqlCell::Null,
    }
}
pub fn is_write(sql: &str) -> io::Result<bool> {
    let stmt = language::ast(sql)?;
    if let Stmt::Create { table, fields } = &stmt {
        validate_create(table, fields)?;
    }
    Ok(!matches!(stmt, Stmt::Select { .. }))
}
// A necessary PK equality is safe under AND, never inferred through OR or NOT.
fn necessary_key(e: &Expr, pk: &str) -> Option<i64> {
    match e {
        Expr::Compare(Operand::Column(c), Cmp::Eq, Operand::Value(Datum::Int(n)))
        | Expr::Compare(Operand::Value(Datum::Int(n)), Cmp::Eq, Operand::Column(c))
            if c == pk =>
        {
            Some(*n)
        }
        Expr::And(a, b) => necessary_key(a, pk).or_else(|| necessary_key(b, pk)),
        _ => None,
    }
}
fn report(
    store: &storage::Store,
    fields: &[Field],
    filter: &Option<Expr>,
    mode: AccessMode,
) -> io::Result<PlanReport> {
    let estimate = store.heap_pages().saturating_mul(8).max(1);
    let key = filter
        .as_ref()
        .and_then(|e| necessary_key(e, &fields[0].name));
    let index_cost = key.map(|_| 3);
    let choose = key.is_some()
        && mode != AccessMode::Sequential
        && (mode == AccessMode::ForceIndex || estimate > 3);
    if mode == AccessMode::ForceIndex && key.is_none() {
        return Err(bad("no necessary primary-key equality for index lookup"));
    }
    Ok(PlanReport {
        access: if choose {
            "PrimaryKeyLookup"
        } else {
            "SeqScan"
        }
        .into(),
        estimated_rows: estimate,
        estimated_cost: if choose { 3 } else { estimate },
        seq_cost: estimate,
        index_cost,
        lookup_key: key,
        reason: if choose {
            "necessary primary-key equality; index model cost is lower"
        } else if key.is_none() {
            "no safe primary-key point predicate"
        } else {
            "sequential access requested or estimated scan is cheaper"
        }
        .into(),
    })
}
struct PointScan<'a> {
    store: &'a mut storage::Store,
    table: String,
    key: i64,
    done: bool,
    stats: Counters,
}
impl Op for PointScan<'_> {
    fn next(&mut self) -> io::Result<Option<Row>> {
        if self.done {
            return Ok(None);
        }
        self.done = true;
        let row = self.store.lookup(&self.table, self.key)?;
        if row.is_some() {
            self.stats.borrow_mut().scan_rows += 1;
        }
        Ok(row)
    }
}
pub fn inspect(dir: &Path, sql: &str, mode: AccessMode) -> io::Result<PlanReport> {
    let Stmt::Select {
        table,
        columns,
        filter,
        order,
        limit,
    } = language::ast(sql)?
    else {
        return Err(bad("EXPLAIN supports SELECT only"));
    };
    let store = storage::Store::open(dir, false)?;
    let fields = store.fields(&table)?;
    bind_select(&fields, columns, filter.clone(), order, limit)?;
    report(&store, &fields, &filter, mode)
}
// Bound bytes while collecting, before JSON and typed-response copies are built.
// Six bytes per UTF-8 byte covers JSON control escaping; per-cell overhead covers
// both JSON type wrappers and wire lengths. The budget is intentionally conservative.
fn collect_bounded(mut op: Box<dyn Op + '_>, stats: &Counters) -> io::Result<Vec<Row>> {
    let mut rows = Vec::new();
    let mut bytes = 4096usize;
    while let Some(row) = op.next()? {
        let row_bytes = row.iter().fold(0usize, |sum, value| {
            sum.saturating_add(64).saturating_add(match value {
                Datum::Text(s) => s.len().saturating_mul(6),
                Datum::Int(_) => 20,
                Datum::Null => 0,
            })
        });
        bytes = bytes.saturating_add(row_bytes);
        if bytes > 8 * 1024 * 1024 || rows.len() >= BUFFER_ROWS {
            return Err(bad(
                "result exceeds conservative 8 MiB or 10000 row buffer limit",
            ));
        }
        stats.borrow_mut().output_rows += 1;
        rows.push(row);
    }
    Ok(rows)
}
pub fn run_sql(dir: &Path, sql: &str) -> io::Result<SqlReply> {
    run_mode(dir, sql, AccessMode::Sequential)
}
pub fn run_optimized(dir: &Path, sql: &str) -> io::Result<SqlReply> {
    run_mode(dir, sql, AccessMode::Auto)
}
pub fn run_mode(dir: &Path, sql: &str, mode: AccessMode) -> io::Result<SqlReply> {
    let stmt = language::ast(sql)?;
    if let Stmt::Create { table, fields } = &stmt {
        validate_create(table, fields)?;
    }
    let mut store = storage::Store::open(dir, matches!(stmt, Stmt::Create { .. }))?;
    match stmt {
        Stmt::Select {
            table,
            columns,
            filter,
            order,
            limit,
        } => {
            let fields = store.fields(&table)?;
            let plan = bind_select(&fields, columns, filter.clone(), order, limit)?;
            let access = report(&store, &fields, &filter, mode)?;
            let stats = counters();
            let output_columns = plan
                .columns
                .iter()
                .map(|&i| SqlColumn {
                    name: fields[i].name.clone(),
                    kind: if fields[i].kind == Type::Int {
                        SqlType::Int
                    } else {
                        SqlType::Text
                    },
                })
                .collect();
            let source: Box<dyn Op + '_> = if access.access == "PrimaryKeyLookup" {
                Box::new(PointScan {
                    store: &mut store,
                    table,
                    key: access.lookup_key.unwrap(),
                    done: false,
                    stats: stats.clone(),
                })
            } else {
                Box::new(store.scan(&table, stats.clone())?)
            };
            let rows = collect_bounded(pipeline(source, &plan, stats.clone()), &stats)?;
            let json = output(&plan.names, &rows, &stats.borrow());
            Ok(SqlReply {
                columns: output_columns,
                rows: rows
                    .iter()
                    .map(|r| r.iter().map(sql_cell).collect())
                    .collect(),
                tag: format!("SELECT {}", rows.len()),
                json,
            })
        }
        s => {
            let tag = if matches!(&s, Stmt::Create { .. }) {
                "CREATE TABLE"
            } else {
                "INSERT 0 1"
            };
            let json = execute(&mut store, s)?;
            Ok(SqlReply {
                columns: vec![],
                rows: vec![],
                tag: tag.into(),
                json,
            })
        }
    }
}
pub fn explain(dir: &Path, sql: &str, analyze: bool) -> io::Result<SqlReply> {
    let p = inspect(dir, sql, AccessMode::Auto)?;
    let mut lines = vec![
        format!(
            "{} (estimated cost={}, rows={})",
            p.access, p.estimated_cost, p.estimated_rows
        ),
        format!("Reason: {}", p.reason),
        "Estimate: global heap pages × 8; model units, not measured I/O or time".into(),
    ];
    if analyze {
        let result = run_optimized(dir, sql)?;
        lines.push(format!("Actual output rows: {}", result.rows.len()));
        lines.push(result.json);
    }
    let rows = lines
        .iter()
        .map(|s| vec![SqlCell::Text(s.clone())])
        .collect::<Vec<_>>();
    let json = format!(
        "{{\"columns\":[\"QUERY PLAN\"],\"rows\":[{}]}}",
        lines
            .iter()
            .map(|s| format!("[{{\"type\":\"text\",\"value\":{}}}]", q(s)))
            .collect::<Vec<_>>()
            .join(",")
    );
    Ok(SqlReply {
        columns: vec![SqlColumn {
            name: "QUERY PLAN".into(),
            kind: SqlType::Text,
        }],
        rows,
        tag: "EXPLAIN".into(),
        json,
    })
}

#[cfg(test)]
mod bridge_tests {
    use super::*;
    fn database(name: &str) -> std::path::PathBuf {
        let p = std::env::temp_dir().join(format!("mydb-bridge-{}-{name}", std::process::id()));
        let _ = std::fs::remove_dir_all(&p);
        std::fs::create_dir_all(&p).unwrap();
        run_sql(&p, "CREATE TABLE t (id INT NOT NULL, name TEXT)").unwrap();
        for i in 0..12 {
            run_sql(&p, &format!("INSERT INTO t VALUES ({i}, '한글')")).unwrap();
        }
        p
    }
    #[test]
    fn response_byte_limit_is_checked_during_collection() {
        struct Wide {
            count: usize,
        }
        impl Op for Wide {
            fn next(&mut self) -> io::Result<Option<Row>> {
                self.count += 1;
                if self.count > 100 {
                    return Ok(None);
                }
                Ok(Some(vec![Datum::Text("x".repeat(1000)); 200]))
            }
        }
        let stats = counters();
        let err = collect_bounded(Box::new(Wide { count: 0 }), &stats).unwrap_err();
        assert!(err.to_string().contains("8 MiB"));
        assert!(stats.borrow().output_rows < 10);
    }
    #[test]
    fn point_and_scan_match() {
        let p = database("point");
        for sql in [
            "SELECT * FROM t WHERE id = 7",
            "SELECT name FROM t WHERE 7 = id AND name = '한글'",
            "SELECT * FROM t WHERE id = 100",
            "SELECT * FROM t WHERE id = 7 AND id = 8",
            "SELECT * FROM t WHERE id = 7 LIMIT 0",
        ] {
            let a = run_mode(&p, sql, AccessMode::Sequential).unwrap();
            let b = run_mode(&p, sql, AccessMode::ForceIndex).unwrap();
            assert_eq!(a.rows, b.rows);
            assert_eq!(a.columns, b.columns);
        }
        std::fs::remove_dir_all(p).unwrap();
    }
    #[test]
    fn unsafe_or_and_not_use_scan() {
        let p = database("or");
        for sql in [
            "SELECT * FROM t WHERE id = 1 OR id = 2",
            "SELECT * FROM t WHERE NOT id = 1",
        ] {
            assert_eq!(
                inspect(&p, sql, AccessMode::Auto).unwrap().access,
                "SeqScan"
            );
            assert!(run_mode(&p, sql, AccessMode::ForceIndex).is_err());
        }
        std::fs::remove_dir_all(p).unwrap();
    }
    #[test]
    fn bind_before_choice_and_empty_metadata() {
        let p = database("bind");
        assert!(run_optimized(&p, "SELECT missing FROM t WHERE id = 999").is_err());
        assert!(run_optimized(&p, "SELECT * FROM t WHERE id = 999 AND name = 4").is_err());
        let r = run_optimized(&p, "SELECT id, name FROM t LIMIT 0").unwrap();
        assert!(r.rows.is_empty());
        assert_eq!(r.columns[0].kind, SqlType::Int);
        assert_eq!(r.columns[1].kind, SqlType::Text);
        assert!(r.json.contains("\"scan_rows\":0"));
        std::fs::remove_dir_all(p).unwrap();
    }
    #[test]
    fn explain_uses_actual_path() {
        let p = database("explain");
        let r = explain(&p, "SELECT * FROM t WHERE id = 4", true).unwrap();
        assert!(format!("{:?}", r.rows).contains("PrimaryKeyLookup"));
        assert!(format!("{:?}", r.rows).contains("scan_rows"));
        assert!(explain(&p, "INSERT INTO t VALUES (90, NULL)", true).is_err());
        std::fs::remove_dir_all(p).unwrap();
    }
}
