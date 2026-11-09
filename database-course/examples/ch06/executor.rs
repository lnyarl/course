use std::{
    cell::RefCell,
    cmp::Ordering,
    collections::{HashMap, HashSet},
    io::{self, Read},
    path::Path,
    rc::Rc,
};
const BUFFER_ROWS: usize = 10_000;
fn bad(message: &str) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidInput, message)
}
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Type {
    Int,
    Text,
}
#[derive(Debug, Clone, PartialEq, Eq)]
struct Field {
    name: String,
    kind: Type,
    nullable: bool,
}
#[derive(Debug, Clone, PartialEq, Eq, Hash)]
enum Datum {
    Int(i64),
    Text(String),
    Null,
}
type Row = Vec<Datum>;
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Cmp {
    Eq,
    Ne,
    Lt,
    Le,
    Gt,
    Ge,
}
#[derive(Debug, Clone)]
enum Operand {
    Column(String),
    Value(Datum),
}
#[derive(Debug, Clone)]
enum Expr {
    Compare(Operand, Cmp, Operand),
    IsNull(Operand, bool),
    Not(Box<Expr>),
    And(Box<Expr>, Box<Expr>),
    Or(Box<Expr>, Box<Expr>),
}
#[derive(Debug, Clone)]
struct Order {
    name: String,
    descending: bool,
}
#[derive(Debug, Clone)]
enum Stmt {
    Create {
        table: String,
        fields: Vec<Field>,
    },
    Insert {
        table: String,
        columns: Option<Vec<String>>,
        values: Row,
    },
    Select {
        table: String,
        columns: Option<Vec<String>>,
        filter: Option<Expr>,
        order: Vec<Order>,
        limit: Option<u64>,
    },
}
#[allow(dead_code)]
mod language {
    include!("../ch05/sql.rs");
    fn value(v: Literal) -> super::Datum {
        match v {
            Literal::Int(n) => super::Datum::Int(n),
            Literal::Text(s) => super::Datum::Text(s),
            Literal::Null => super::Datum::Null,
        }
    }
    fn operand(o: Operand) -> super::Operand {
        match o {
            Operand::Column(n) => super::Operand::Column(n),
            Operand::Value(v) => super::Operand::Value(value(v)),
        }
    }
    fn expr(e: Expr) -> super::Expr {
        use super::{Cmp as C, Expr as E};
        match e {
            Expr::Compare { left, op, right } => E::Compare(
                operand(left),
                match op {
                    Compare::Eq => C::Eq,
                    Compare::Ne => C::Ne,
                    Compare::Lt => C::Lt,
                    Compare::Le => C::Le,
                    Compare::Gt => C::Gt,
                    Compare::Ge => C::Ge,
                },
                operand(right),
            ),
            Expr::IsNull { value, negated } => E::IsNull(operand(value), negated),
            Expr::Not(v) => E::Not(Box::new(expr(*v))),
            Expr::And(a, b) => E::And(Box::new(expr(*a)), Box::new(expr(*b))),
            Expr::Or(a, b) => E::Or(Box::new(expr(*a)), Box::new(expr(*b))),
        }
    }
    pub fn ast(sql: &str) -> io::Result<super::Stmt> {
        let statement =
            parse(sql).map_err(|e| io::Error::new(io::ErrorKind::InvalidInput, e.to_string()))?;
        Ok(match statement {
            Statement::Create { table, columns } => super::Stmt::Create {
                table,
                fields: columns
                    .into_iter()
                    .map(|c| super::Field {
                        name: c.name,
                        kind: if c.data_type == "int" {
                            super::Type::Int
                        } else {
                            super::Type::Text
                        },
                        nullable: c.nullable,
                    })
                    .collect(),
            },
            Statement::Insert {
                table,
                columns,
                values,
            } => super::Stmt::Insert {
                table,
                columns,
                values: values.into_iter().map(value).collect(),
            },
            Statement::Select {
                table,
                columns,
                filter,
                order,
                limit,
            } => super::Stmt::Select {
                table,
                columns,
                filter: filter.map(expr),
                order: order
                    .into_iter()
                    .map(|o| super::Order {
                        name: o.column,
                        descending: o.descending,
                    })
                    .collect(),
                limit: limit.map(|n| n as u64),
            },
        })
    }
    pub fn json_string(s: &str) -> String {
        quote(s)
    }
}
#[derive(Debug, Default, Clone, PartialEq, Eq)]
struct Stats {
    scan_rows: u64,
    filter_checks: u64,
    sort_rows: u64,
    output_rows: u64,
    join_checks: u64,
    hash_build: u64,
    hash_probe: u64,
}
type Counters = Rc<RefCell<Stats>>;
fn counters() -> Counters {
    Rc::new(RefCell::new(Stats::default()))
}
trait Op {
    fn next(&mut self) -> io::Result<Option<Row>>;
}
#[allow(dead_code)]
mod storage {
    include!("../ch04/tables.rs");
    pub struct Store(Db);
    fn field(c: &Column) -> super::Field {
        super::Field {
            name: c.name.clone(),
            kind: match c.kind {
                Kind::Int => super::Type::Int,
                Kind::Text => super::Type::Text,
            },
            nullable: c.nullable,
        }
    }
    fn datum(v: Value) -> super::Datum {
        match v {
            Value::Int(n) => super::Datum::Int(n),
            Value::Text(s) => super::Datum::Text(s),
            Value::Null => super::Datum::Null,
        }
    }
    pub struct Scan<'a> {
        db: &'a mut Db,
        table: Table,
        page: u64,
        slot: usize,
        count: usize,
        entered: HashSet<u64>,
        finished: bool,
        stats: super::Counters,
    }
    impl Store {
        pub fn open(dir: &Path, create_db: bool) -> io::Result<Self> {
            if !create_db {
                let path = dir.join("tables.pages");
                if !path.is_file() {
                    return Err(io::Error::new(
                        io::ErrorKind::NotFound,
                        "database does not exist",
                    ));
                }
                if path.metadata()?.len() == 0 {
                    return Err(bad("existing catalog file is empty"));
                }
            }
            Ok(Self(Db::open(dir)?))
        }
        pub fn fields(&self, name: &str) -> io::Result<Vec<super::Field>> {
            let i = self.0.table(name)?;
            Ok(self.0.tables[i].schema.iter().map(field).collect())
        }
        pub fn create(&mut self, name: &str, fields: Vec<super::Field>) -> io::Result<()> {
            self.0.create(
                name,
                fields
                    .into_iter()
                    .map(|f| Column {
                        name: f.name,
                        kind: match f.kind {
                            super::Type::Int => Kind::Int,
                            super::Type::Text => Kind::Text,
                        },
                        nullable: f.nullable,
                    })
                    .collect(),
            )
        }
        pub fn insert(&mut self, name: &str, row: super::Row) -> io::Result<(u64, u16)> {
            self.0.insert(
                name,
                row.into_iter()
                    .map(|v| match v {
                        super::Datum::Int(n) => Value::Int(n),
                        super::Datum::Text(s) => Value::Text(s),
                        super::Datum::Null => Value::Null,
                    })
                    .collect(),
            )
        }
        // Constructing a scan does not read a heap page. Each next pulls one row.
        pub fn scan(&mut self, name: &str, stats: super::Counters) -> io::Result<Scan<'_>> {
            let i = self.0.table(name)?;
            let table = self.0.tables[i].clone();
            let page = table.first;
            Ok(Scan {
                db: &mut self.0,
                table,
                page,
                slot: 1,
                count: 0,
                entered: HashSet::new(),
                finished: false,
                stats,
            })
        }
        // Narrow adapters used by the Chapter 09 planner. Chapter 06 remains SeqScan.
        pub fn lookup(&mut self, name: &str, key: i64) -> io::Result<Option<super::Row>> {
            Ok(self.0.get(name, key)?.map(|row| row.into_iter().map(datum).collect()))
        }
        pub fn heap_pages(&self) -> u64 {
            self.0.heap.len().saturating_sub(1)
        }
        pub fn flush(&mut self) -> io::Result<()> {
            self.0.flush()
        }
        #[cfg(test)]
        pub fn corrupt_last_heap_header(&mut self, name: &str) -> io::Result<()> {
            let i = self.0.table(name)?;
            self.0.heap.replace(self.0.tables[i].last, b"bad")
        }
    }
    impl super::Op for Scan<'_> {
        fn next(&mut self) -> io::Result<Option<super::Row>> {
            if self.finished {
                return Ok(None);
            }
            loop {
                if self.count == 0 {
                    if !self.entered.insert(self.page) {
                        return Err(bad("cycle in heap chain"));
                    }
                    self.count = self.db.heap.count(self.page)?;
                    if self.count == 0 {
                        return Err(bad("heap page has no next slot"));
                    }
                }
                if self.slot < self.count {
                    let bytes = self.db.heap.read(self.page, self.slot as u16)?;
                    let row = decode(&self.table.schema, &bytes)?;
                    self.slot += 1;
                    self.stats.borrow_mut().scan_rows += 1;
                    return Ok(Some(row.into_iter().map(datum).collect()));
                }
                let next = self.db.heap.next(self.page)?;
                if next == 0 {
                    if self.page != self.table.last {
                        return Err(bad("bad last heap page"));
                    }
                    self.finished = true;
                    return Ok(None);
                }
                self.page = next;
                self.slot = 1;
                self.count = 0;
            }
        }
    }
}
fn name_index(fields: &[Field], name: &str) -> io::Result<usize> {
    fields
        .iter()
        .position(|f| f.name == name)
        .ok_or_else(|| bad(&format!("unknown column: {name}")))
}
fn datum_type(v: &Datum) -> Option<Type> {
    match v {
        Datum::Int(_) => Some(Type::Int),
        Datum::Text(_) => Some(Type::Text),
        Datum::Null => None,
    }
}
fn validate_row(fields: &[Field], row: &[Datum]) -> io::Result<()> {
    if fields.len() != row.len() {
        return Err(bad("column count mismatch"));
    }
    for (f, v) in fields.iter().zip(row) {
        match datum_type(v) {
            Some(t) if t != f.kind => return Err(bad("incompatible value type")),
            None if !f.nullable => return Err(bad("NOT NULL constraint")),
            _ => {}
        }
    }
    Ok(())
}
fn valid_name(s: &str) -> bool {
    !s.is_empty()
        && s.len() <= 32
        && s.as_bytes()[0].is_ascii_alphabetic()
        && s.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'_')
}
fn validate_create(table: &str, fields: &[Field]) -> io::Result<()> {
    if !valid_name(table) || fields.is_empty() || fields.len() > 16 {
        return Err(bad("invalid table definition"));
    }
    if fields[0].kind != Type::Int || fields[0].nullable {
        return Err(bad("first column must be INT NOT NULL primary key"));
    }
    let mut names = HashSet::new();
    for f in fields {
        if !valid_name(&f.name) || !names.insert(&f.name) {
            return Err(bad("bad or duplicate column name"));
        }
    }
    Ok(())
}
fn bind_insert(fields: &[Field], columns: Option<&[String]>, values: Row) -> io::Result<Row> {
    if let Some(columns) = columns {
        if columns.len() != values.len() {
            return Err(bad("INSERT column/value count mismatch"));
        }
        let mut seen = HashSet::new();
        let mut row = vec![Datum::Null; fields.len()];
        for (name, value) in columns.iter().zip(values) {
            let i = name_index(fields, name)?;
            if !seen.insert(i) {
                return Err(bad("duplicate INSERT column"));
            }
            row[i] = value;
        }
        validate_row(fields, &row)?;
        Ok(row)
    } else {
        validate_row(fields, &values)?;
        Ok(values)
    }
}
#[derive(Debug, Clone)]
enum BoundOperand {
    Column(usize, Type),
    Value(Datum),
}
impl BoundOperand {
    fn kind(&self) -> Option<Type> {
        match self {
            Self::Column(_, t) => Some(*t),
            Self::Value(v) => datum_type(v),
        }
    }
    fn value<'a>(&'a self, row: &'a [Datum]) -> io::Result<&'a Datum> {
        match self {
            Self::Column(i, _) => row
                .get(*i)
                .ok_or_else(|| bad("row is missing bound column")),
            Self::Value(v) => Ok(v),
        }
    }
}
#[derive(Debug, Clone)]
enum BoundExpr {
    Compare(BoundOperand, Cmp, BoundOperand),
    IsNull(BoundOperand, bool),
    Not(Box<BoundExpr>),
    And(Box<BoundExpr>, Box<BoundExpr>),
    Or(Box<BoundExpr>, Box<BoundExpr>),
}
fn bind_operand(fields: &[Field], o: Operand) -> io::Result<BoundOperand> {
    match o {
        Operand::Column(name) => {
            let i = name_index(fields, &name)?;
            Ok(BoundOperand::Column(i, fields[i].kind))
        }
        Operand::Value(v) => Ok(BoundOperand::Value(v)),
    }
}
fn bind_expr(fields: &[Field], expr: Expr) -> io::Result<BoundExpr> {
    Ok(match expr {
        Expr::Compare(a, op, b) => {
            let a = bind_operand(fields, a)?;
            let b = bind_operand(fields, b)?;
            if a.kind().is_some() && b.kind().is_some() && a.kind() != b.kind() {
                return Err(bad("incompatible comparison types"));
            }
            BoundExpr::Compare(a, op, b)
        }
        Expr::IsNull(v, n) => BoundExpr::IsNull(bind_operand(fields, v)?, n),
        Expr::Not(v) => BoundExpr::Not(Box::new(bind_expr(fields, *v)?)),
        Expr::And(a, b) => BoundExpr::And(
            Box::new(bind_expr(fields, *a)?),
            Box::new(bind_expr(fields, *b)?),
        ),
        Expr::Or(a, b) => BoundExpr::Or(
            Box::new(bind_expr(fields, *a)?),
            Box::new(bind_expr(fields, *b)?),
        ),
    })
}
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Truth {
    True,
    False,
    Unknown,
}
impl Truth {
    fn not(self) -> Self {
        match self {
            Self::True => Self::False,
            Self::False => Self::True,
            Self::Unknown => Self::Unknown,
        }
    }
    fn and(self, b: Self) -> Self {
        match (self, b) {
            (Self::False, _) | (_, Self::False) => Self::False,
            (Self::True, Self::True) => Self::True,
            _ => Self::Unknown,
        }
    }
    fn or(self, b: Self) -> Self {
        match (self, b) {
            (Self::True, _) | (_, Self::True) => Self::True,
            (Self::False, Self::False) => Self::False,
            _ => Self::Unknown,
        }
    }
    fn from_bool(b: bool) -> Self {
        if b { Self::True } else { Self::False }
    }
}
fn compare(a: &Datum, b: &Datum) -> io::Result<Option<Ordering>> {
    match (a, b) {
        (Datum::Null, _) | (_, Datum::Null) => Ok(None),
        (Datum::Int(a), Datum::Int(b)) => Ok(Some(a.cmp(b))),
        (Datum::Text(a), Datum::Text(b)) => Ok(Some(a.cmp(b))),
        _ => Err(bad("incompatible comparison types")),
    }
}
impl BoundExpr {
    fn eval(&self, row: &[Datum]) -> io::Result<Truth> {
        Ok(match self {
            Self::Compare(a, op, b) => match compare(a.value(row)?, b.value(row)?)? {
                None => Truth::Unknown,
                Some(ord) => Truth::from_bool(match op {
                    Cmp::Eq => ord == Ordering::Equal,
                    Cmp::Ne => ord != Ordering::Equal,
                    Cmp::Lt => ord == Ordering::Less,
                    Cmp::Le => ord != Ordering::Greater,
                    Cmp::Gt => ord == Ordering::Greater,
                    Cmp::Ge => ord != Ordering::Less,
                }),
            },
            Self::IsNull(v, negated) => {
                Truth::from_bool(matches!(v.value(row)?, Datum::Null) ^ negated)
            }
            Self::Not(v) => v.eval(row)?.not(),
            Self::And(a, b) => a.eval(row)?.and(b.eval(row)?),
            Self::Or(a, b) => a.eval(row)?.or(b.eval(row)?),
        })
    }
}
struct Values {
    rows: std::vec::IntoIter<Row>,
}
impl Values {
    fn new(rows: Vec<Row>) -> Self {
        Self {
            rows: rows.into_iter(),
        }
    }
}
impl Op for Values {
    fn next(&mut self) -> io::Result<Option<Row>> {
        Ok(self.rows.next())
    }
}
struct Filter<'a> {
    source: Box<dyn Op + 'a>,
    predicate: BoundExpr,
    stats: Counters,
}
impl Op for Filter<'_> {
    fn next(&mut self) -> io::Result<Option<Row>> {
        while let Some(row) = self.source.next()? {
            self.stats.borrow_mut().filter_checks += 1;
            if self.predicate.eval(&row)? == Truth::True {
                return Ok(Some(row));
            }
        }
        Ok(None)
    }
}
struct Project<'a> {
    source: Box<dyn Op + 'a>,
    columns: Vec<usize>,
}
impl Op for Project<'_> {
    fn next(&mut self) -> io::Result<Option<Row>> {
        self.source
            .next()?
            .map(|row| {
                self.columns
                    .iter()
                    .map(|&i| {
                        row.get(i)
                            .cloned()
                            .ok_or_else(|| bad("row missing projection column"))
                    })
                    .collect()
            })
            .transpose()
    }
}
struct Limit<'a> {
    source: Box<dyn Op + 'a>,
    remaining: u64,
}
impl Op for Limit<'_> {
    fn next(&mut self) -> io::Result<Option<Row>> {
        if self.remaining == 0 {
            return Ok(None);
        }
        let row = self.source.next()?;
        if row.is_some() {
            self.remaining -= 1;
        } else {
            self.remaining = 0;
        }
        Ok(row)
    }
}
#[derive(Clone)]
struct SortKey {
    index: usize,
    kind: Type,
    descending: bool,
}
struct Sort<'a> {
    source: Box<dyn Op + 'a>,
    keys: Vec<SortKey>,
    rows: Option<std::vec::IntoIter<Row>>,
    stats: Counters,
}
fn sort_cmp(a: &Datum, b: &Datum) -> Ordering {
    match (a, b) {
        (Datum::Null, Datum::Null) => Ordering::Equal,
        (Datum::Null, _) => Ordering::Greater,
        (_, Datum::Null) => Ordering::Less,
        (Datum::Int(a), Datum::Int(b)) => a.cmp(b),
        (Datum::Text(a), Datum::Text(b)) => a.cmp(b),
        _ => unreachable!("sort rows checked before sorting"),
    }
}
impl Op for Sort<'_> {
    fn next(&mut self) -> io::Result<Option<Row>> {
        if self.rows.is_none() {
            let mut rows = vec![];
            while let Some(row) = self.source.next()? {
                if rows.len() >= BUFFER_ROWS {
                    return Err(bad("sort buffer exceeds 10000 rows"));
                }
                for key in &self.keys {
                    let v = row
                        .get(key.index)
                        .ok_or_else(|| bad("row missing sort column"))?;
                    if datum_type(v).is_some_and(|t| t != key.kind) {
                        return Err(bad("bad sort value type"));
                    }
                }
                self.stats.borrow_mut().sort_rows += 1;
                rows.push(row);
            }
            rows.sort_by(|a, b| {
                for key in &self.keys {
                    let ord = sort_cmp(&a[key.index], &b[key.index]);
                    let ord = if key.descending { ord.reverse() } else { ord };
                    if ord != Ordering::Equal {
                        return ord;
                    }
                }
                Ordering::Equal
            });
            self.rows = Some(rows.into_iter());
        }
        Ok(self.rows.as_mut().unwrap().next())
    }
}
struct Plan {
    columns: Vec<usize>,
    names: Vec<String>,
    filter: Option<BoundExpr>,
    order: Vec<SortKey>,
    limit: Option<u64>,
}
fn bind_select(
    fields: &[Field],
    columns: Option<Vec<String>>,
    filter: Option<Expr>,
    order: Vec<Order>,
    limit: Option<u64>,
) -> io::Result<Plan> {
    let columns = match columns {
        Some(cols) => cols
            .iter()
            .map(|n| name_index(fields, n))
            .collect::<io::Result<Vec<_>>>()?,
        None => (0..fields.len()).collect(),
    };
    let names = columns.iter().map(|&i| fields[i].name.clone()).collect();
    let filter = filter.map(|f| bind_expr(fields, f)).transpose()?;
    let order = order
        .into_iter()
        .map(|o| {
            let index = name_index(fields, &o.name)?;
            Ok(SortKey {
                index,
                kind: fields[index].kind,
                descending: o.descending,
            })
        })
        .collect::<io::Result<_>>()?;
    Ok(Plan {
        columns,
        names,
        filter,
        order,
        limit,
    })
}
fn pipeline<'a>(source: Box<dyn Op + 'a>, plan: &Plan, stats: Counters) -> Box<dyn Op + 'a> {
    let mut source = source;
    if let Some(predicate) = &plan.filter {
        source = Box::new(Filter {
            source,
            predicate: predicate.clone(),
            stats: stats.clone(),
        });
    }
    if !plan.order.is_empty() {
        source = Box::new(Sort {
            source,
            keys: plan.order.clone(),
            rows: None,
            stats: stats.clone(),
        });
    }
    if let Some(remaining) = plan.limit {
        source = Box::new(Limit { source, remaining });
    }
    Box::new(Project {
        source,
        columns: plan.columns.clone(),
    })
}
fn collect(mut op: Box<dyn Op + '_>, stats: &Counters) -> io::Result<Vec<Row>> {
    let mut rows = vec![];
    while let Some(row) = op.next()? {
        if rows.len() >= BUFFER_ROWS {
            return Err(bad("result buffer exceeds 10000 rows"));
        }
        stats.borrow_mut().output_rows += 1;
        rows.push(row);
    }
    Ok(rows)
}
#[derive(Clone, Copy)]
struct JoinKeys {
    left: usize,
    right: usize,
    kind: Type,
}
fn bind_join(left: &[Field], right: &[Field], li: usize, ri: usize) -> io::Result<JoinKeys> {
    let a = left
        .get(li)
        .ok_or_else(|| bad("left join column missing"))?;
    let b = right
        .get(ri)
        .ok_or_else(|| bad("right join column missing"))?;
    if a.kind != b.kind {
        return Err(bad("incompatible join key types"));
    }
    Ok(JoinKeys {
        left: li,
        right: ri,
        kind: a.kind,
    })
}
fn key(row: &[Datum], index: usize, kind: Type) -> io::Result<Option<Datum>> {
    let v = row.get(index).ok_or_else(|| bad("row missing join key"))?;
    if datum_type(v).is_some_and(|t| t != kind) {
        return Err(bad("bad join key type"));
    }
    Ok(if matches!(v, Datum::Null) {
        None
    } else {
        Some(v.clone())
    })
}
struct NestedJoin<'a> {
    left: Box<dyn Op + 'a>,
    right: Box<dyn Op + 'a>,
    keys: JoinKeys,
    buffer: Option<Vec<Row>>,
    current: Option<Row>,
    position: usize,
    stats: Counters,
}
impl<'a> NestedJoin<'a> {
    fn new(
        left: Box<dyn Op + 'a>,
        right: Box<dyn Op + 'a>,
        keys: JoinKeys,
        stats: Counters,
    ) -> Self {
        Self {
            left,
            right,
            keys,
            buffer: None,
            current: None,
            position: 0,
            stats,
        }
    }
}
impl Op for NestedJoin<'_> {
    fn next(&mut self) -> io::Result<Option<Row>> {
        if self.buffer.is_none() {
            let mut b = vec![];
            while let Some(row) = self.right.next()? {
                if b.len() >= BUFFER_ROWS {
                    return Err(bad("join right buffer exceeds 10000 rows"));
                }
                key(&row, self.keys.right, self.keys.kind)?;
                b.push(row);
            }
            self.buffer = Some(b);
        }
        loop {
            if self.current.is_none() {
                self.current = self.left.next()?;
                self.position = 0;
                if self.current.is_none() {
                    return Ok(None);
                }
            }
            let left = self.current.as_ref().unwrap();
            let left_key = key(left, self.keys.left, self.keys.kind)?;
            let buffer = self.buffer.as_ref().unwrap();
            while self.position < buffer.len() {
                let right = &buffer[self.position];
                self.position += 1;
                self.stats.borrow_mut().join_checks += 1;
                if left_key.is_some() && left_key == key(right, self.keys.right, self.keys.kind)? {
                    let mut row = left.clone();
                    row.extend_from_slice(right);
                    return Ok(Some(row));
                }
            }
            self.current = None;
        }
    }
}
struct HashJoin<'a> {
    left: Box<dyn Op + 'a>,
    right: Box<dyn Op + 'a>,
    keys: JoinKeys,
    table: Option<HashMap<Datum, Vec<Row>>>,
    current: Option<Row>,
    match_key: Option<Datum>,
    position: usize,
    stats: Counters,
}
impl<'a> HashJoin<'a> {
    fn new(
        left: Box<dyn Op + 'a>,
        right: Box<dyn Op + 'a>,
        keys: JoinKeys,
        stats: Counters,
    ) -> Self {
        Self {
            left,
            right,
            keys,
            table: None,
            current: None,
            match_key: None,
            position: 0,
            stats,
        }
    }
}
impl Op for HashJoin<'_> {
    fn next(&mut self) -> io::Result<Option<Row>> {
        if self.table.is_none() {
            let mut table: HashMap<Datum, Vec<Row>> = HashMap::new();
            let mut count = 0;
            while let Some(row) = self.right.next()? {
                if let Some(k) = key(&row, self.keys.right, self.keys.kind)? {
                    if count >= BUFFER_ROWS {
                        return Err(bad("hash build buffer exceeds 10000 non-NULL rows"));
                    }
                    count += 1;
                    table.entry(k).or_default().push(row);
                    self.stats.borrow_mut().hash_build += 1;
                }
            }
            self.table = Some(table);
        }
        loop {
            if let Some(k) = &self.match_key {
                if let Some(matches) = self.table.as_ref().unwrap().get(k) {
                    if self.position < matches.len() {
                        let right = &matches[self.position];
                        self.position += 1;
                        let mut row = self.current.as_ref().unwrap().clone();
                        row.extend_from_slice(right);
                        return Ok(Some(row));
                    }
                }
            }
            let Some(left) = self.left.next()? else {
                return Ok(None);
            };
            self.position = 0;
            self.match_key = key(&left, self.keys.left, self.keys.kind)?;
            if self.match_key.is_some() {
                self.stats.borrow_mut().hash_probe += 1;
            }
            self.current = Some(left);
        }
    }
}
fn q(s: &str) -> String {
    language::json_string(s)
}
fn datum_json(d: &Datum) -> String {
    match d {
        Datum::Int(n) => format!("{{\"type\":\"int\",\"value\":{}}}", q(&n.to_string())),
        Datum::Text(s) => format!("{{\"type\":\"text\",\"value\":{}}}", q(s)),
        Datum::Null => "{\"type\":\"null\"}".into(),
    }
}
fn array(items: impl IntoIterator<Item = String>) -> String {
    format!("[{}]", items.into_iter().collect::<Vec<_>>().join(","))
}
fn output(columns: &[String], rows: &[Row], stats: &Stats) -> String {
    format!(
        "{{\"columns\":{},\"rows\":{},\"stats\":{{\"scan_rows\":{},\"filter_checks\":{},\"sort_rows\":{},\"output_rows\":{},\"join_checks\":{},\"hash_build\":{},\"hash_probe\":{}}}}}",
        array(columns.iter().map(|s| q(s))),
        array(rows.iter().map(|row| array(row.iter().map(datum_json)))),
        stats.scan_rows,
        stats.filter_checks,
        stats.sort_rows,
        stats.output_rows,
        stats.join_checks,
        stats.hash_build,
        stats.hash_probe
    )
}
fn execute(store: &mut storage::Store, stmt: Stmt) -> io::Result<String> {
    match stmt {
        Stmt::Create { table, fields } => {
            validate_create(&table, &fields)?;
            store.create(&table, fields)?;
            store.flush()?;
            Ok(format!("{{\"type\":\"create\",\"table\":{}}}", q(&table)))
        }
        Stmt::Insert {
            table,
            columns,
            values,
        } => {
            let fields = store.fields(&table)?;
            let row = bind_insert(&fields, columns.as_deref(), values)?;
            let (page, slot) = store.insert(&table, row)?;
            store.flush()?;
            Ok(format!(
                "{{\"type\":\"insert\",\"rid\":{{\"page\":{page},\"slot\":{slot}}}}}"
            ))
        }
        Stmt::Select {
            table,
            columns,
            filter,
            order,
            limit,
        } => {
            let fields = store.fields(&table)?;
            let plan = bind_select(&fields, columns, filter, order, limit)?;
            let stats = counters();
            let scan = store.scan(&table, stats.clone())?;
            let rows = collect(pipeline(Box::new(scan), &plan, stats.clone()), &stats)?;
            let result = output(&plan.names, &rows, &stats.borrow());
            Ok(result)
        }
    }
}
fn demo_data() -> (Vec<Field>, Vec<Row>, Vec<Field>, Vec<Row>) {
    use Datum::{Int as I, Null as N, Text as T};
    let f = |name: &str, kind, nullable| Field {
        name: name.into(),
        kind,
        nullable,
    };
    (
        vec![
            f("id", Type::Int, false),
            f("name", Type::Text, false),
            f("age", Type::Int, true),
            f("dept", Type::Int, true),
        ],
        vec![
            vec![I(1), T("Roy".into()), I(35), I(10)],
            vec![I(2), T("Ana".into()), I(20), I(20)],
            vec![I(3), T("Bo".into()), N, I(10)],
            vec![I(4), T("Dana".into()), I(28), N],
            vec![I(5), T("Eli".into()), I(40), I(30)],
        ],
        vec![
            f("dept_key", Type::Int, true),
            f("label", Type::Text, false),
        ],
        vec![
            vec![I(10), T("Eng".into())],
            vec![I(20), T("Ops".into())],
            vec![I(10), T("Field".into())],
            vec![N, T("Unknown".into())],
            vec![I(40), T("Legal".into())],
        ],
    )
}
fn join_demo(method: &str) -> io::Result<String> {
    let (left_fields, left, right_fields, right) = demo_data();
    let keys = bind_join(&left_fields, &right_fields, 3, 0)?;
    let stats = counters();
    let left: Box<dyn Op> = Box::new(Values::new(left));
    let right: Box<dyn Op> = Box::new(Values::new(right));
    let join: Box<dyn Op> = match method {
        "nested" => Box::new(NestedJoin::new(left, right, keys, stats.clone())),
        "hash" => Box::new(HashJoin::new(left, right, keys, stats.clone())),
        _ => return Err(bad("join demo expects nested or hash")),
    };
    let rows = collect(join, &stats)?;
    let columns = left_fields
        .iter()
        .chain(&right_fields)
        .map(|f| f.name.clone())
        .collect::<Vec<_>>();
    let result = output(&columns, &rows, &stats.borrow());
    Ok(result)
}
fn run() -> io::Result<String> {
    let args: Vec<_> = std::env::args().skip(1).collect();
    if let [flag, method] = args.as_slice() {
        if flag == "--join-demo" {
            return join_demo(method);
        }
    }
    let [directory] = args.as_slice() else {
        return Err(bad(
            "usage: executor DIRECTORY < one.sql | executor --join-demo nested|hash",
        ));
    };
    let mut sql = String::new();
    io::stdin().take(16385).read_to_string(&mut sql)?;
    let stmt = language::ast(&sql)?;
    if let Stmt::Create { table, fields } = &stmt {
        validate_create(table, fields)?;
    }
    let create = matches!(stmt, Stmt::Create { .. });
    let mut store = storage::Store::open(Path::new(directory), create)?;
    execute(&mut store, stmt)
}
fn main() {
    match run() {
        Ok(json) => println!("{json}"),
        Err(e) => {
            eprintln!("{e}");
            std::process::exit(2);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use Datum::{Int as I, Null as N, Text as T};
    use std::{
        path::PathBuf,
        sync::atomic::{AtomicU64, Ordering as AtomicOrdering},
    };
    static SEQ: AtomicU64 = AtomicU64::new(0);
    struct Temp(PathBuf);
    impl Temp {
        fn new() -> Self {
            Self(std::env::temp_dir().join(format!(
                "mydb-ch06-{}-{}",
                std::process::id(),
                SEQ.fetch_add(1, AtomicOrdering::Relaxed)
            )))
        }
        fn store(&self) -> storage::Store {
            storage::Store::open(&self.0, true).unwrap()
        }
    }
    impl Drop for Temp {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }
    fn memory(fields: &[Field], rows: Vec<Row>, sql: &str) -> (Vec<Row>, Stats) {
        let Stmt::Select {
            columns,
            filter,
            order,
            limit,
            ..
        } = language::ast(sql).unwrap()
        else {
            panic!()
        };
        let plan = bind_select(fields, columns, filter, order, limit).unwrap();
        let stats = counters();
        let result = collect(
            pipeline(Box::new(Values::new(rows)), &plan, stats.clone()),
            &stats,
        )
        .unwrap();
        let stats = stats.borrow().clone();
        (result, stats)
    }
    fn bound(fields: &[Field], sql: &str) -> io::Result<Plan> {
        let Stmt::Select {
            columns,
            filter,
            order,
            limit,
            ..
        } = language::ast(sql)?
        else {
            panic!()
        };
        bind_select(fields, columns, filter, order, limit)
    }
    fn field(name: &str, kind: Type, nullable: bool) -> Field {
        Field {
            name: name.into(),
            kind,
            nullable,
        }
    }
    struct Bomb;
    impl Op for Bomb {
        fn next(&mut self) -> io::Result<Option<Row>> {
            Err(bad("upstream was pulled"))
        }
    }
    struct Counting {
        source: Values,
        calls: Rc<RefCell<usize>>,
    }
    impl Op for Counting {
        fn next(&mut self) -> io::Result<Option<Row>> {
            *self.calls.borrow_mut() += 1;
            self.source.next()
        }
    }
    #[test]
    fn complete_three_valued_truth_tables() {
        use Truth::{False as B, True as A, Unknown as U};
        let cases = [A, B, U];
        let and = [[A, B, U], [B, B, B], [U, B, U]];
        let or = [[A, A, A], [A, B, U], [A, U, U]];
        for (i, &a) in cases.iter().enumerate() {
            for (j, &b) in cases.iter().enumerate() {
                assert_eq!(a.and(b), and[i][j]);
                assert_eq!(a.or(b), or[i][j]);
            }
        }
        assert_eq!(A.not(), B);
        assert_eq!(B.not(), A);
        assert_eq!(U.not(), U);
    }
    #[test]
    fn null_comparisons_and_is_null_filter() {
        let fields = vec![field("age", Type::Int, true)];
        let rows = vec![vec![N], vec![I(0)], vec![I(30)]];
        assert_eq!(
            memory(&fields, rows.clone(), "SELECT * FROM t WHERE age = NULL").0,
            Vec::<Row>::new()
        );
        assert_eq!(
            memory(&fields, rows.clone(), "SELECT * FROM t WHERE NOT age = 30").0,
            vec![vec![I(0)]]
        );
        assert_eq!(
            memory(
                &fields,
                rows.clone(),
                "SELECT * FROM t WHERE age >=25 OR age IS NULL"
            )
            .0,
            vec![vec![N], vec![I(30)]]
        );
        assert_eq!(
            memory(&fields, rows, "SELECT * FROM t WHERE age IS NOT NULL").0,
            vec![vec![I(0)], vec![I(30)]]
        );
    }
    #[test]
    fn binding_errors_happen_before_pull_even_with_limit_zero() {
        let fields = vec![field("id", Type::Int, false)];
        for sql in [
            "SELECT missing FROM t LIMIT 0",
            "SELECT id FROM t WHERE missing=1 LIMIT 0",
            "SELECT id FROM t ORDER BY missing LIMIT 0",
            "SELECT id FROM t WHERE id='text' LIMIT 0",
            "SELECT id FROM t WHERE 1=0 AND missing=1 LIMIT 0",
            "SELECT id FROM t WHERE 'x'=1 LIMIT 0",
        ] {
            assert!(bound(&fields, sql).is_err(), "accepted {sql}");
        }
    }
    #[test]
    fn limit_zero_does_not_pull_sort_or_any_source() {
        let fields = vec![field("id", Type::Int, false)];
        let plan = bound(&fields, "SELECT id FROM t WHERE id>0 ORDER BY id LIMIT 0").unwrap();
        let stats = counters();
        assert!(
            collect(pipeline(Box::new(Bomb), &plan, stats.clone()), &stats)
                .unwrap()
                .is_empty()
        );
        assert_eq!(*stats.borrow(), Stats::default());
    }
    #[test]
    fn unsorted_limit_stops_after_requested_rows() {
        let fields = vec![field("id", Type::Int, false)];
        let plan = bound(&fields, "SELECT id FROM t LIMIT 2").unwrap();
        let stats = counters();
        let calls = Rc::new(RefCell::new(0));
        let source = Counting {
            source: Values::new(vec![vec![I(1)], vec![I(2)], vec![I(3)]]),
            calls: calls.clone(),
        };
        assert_eq!(
            collect(pipeline(Box::new(source), &plan, stats.clone()), &stats).unwrap(),
            vec![vec![I(1)], vec![I(2)]]
        );
        assert_eq!(*calls.borrow(), 2);
    }
    #[test]
    fn filter_next_pulls_until_one_true_row() {
        let fields = vec![field("id", Type::Int, false)];
        let plan = bound(&fields, "SELECT id FROM t WHERE id>=3").unwrap();
        let stats = counters();
        let calls = Rc::new(RefCell::new(0));
        let mut op = pipeline(
            Box::new(Counting {
                source: Values::new((1..=4).map(|n| vec![I(n)]).collect()),
                calls: calls.clone(),
            }),
            &plan,
            stats.clone(),
        );
        assert_eq!(op.next().unwrap(), Some(vec![I(3)]));
        assert_eq!(*calls.borrow(), 3);
        assert_eq!(stats.borrow().filter_checks, 3);
    }
    #[test]
    fn prototype_query_results_and_operator_stats() {
        let (fields, rows, _, _) = demo_data();
        let (result, stats) = memory(
            &fields,
            rows,
            "SELECT name,age FROM people WHERE age>=25 OR age IS NULL ORDER BY age DESC LIMIT 3",
        );
        assert_eq!(
            result,
            vec![
                vec![T("Bo".into()), N],
                vec![T("Eli".into()), I(40)],
                vec![T("Roy".into()), I(35)]
            ]
        );
        assert_eq!(
            stats,
            Stats {
                filter_checks: 5,
                sort_rows: 4,
                output_rows: 3,
                ..Stats::default()
            }
        );
    }
    #[test]
    fn stable_sort_null_placement_and_hidden_order_column() {
        let fields = vec![
            field("name", Type::Text, false),
            field("age", Type::Int, true),
        ];
        let rows = vec![
            vec![T("first".into()), I(20)],
            vec![T("null".into()), N],
            vec![T("second".into()), I(20)],
            vec![T("older".into()), I(30)],
        ];
        assert_eq!(
            memory(&fields, rows.clone(), "SELECT name FROM t ORDER BY age ASC").0,
            vec![
                vec![T("first".into())],
                vec![T("second".into())],
                vec![T("older".into())],
                vec![T("null".into())]
            ]
        );
        assert_eq!(
            memory(&fields, rows, "SELECT name FROM t ORDER BY age DESC").0,
            vec![
                vec![T("null".into())],
                vec![T("older".into())],
                vec![T("first".into())],
                vec![T("second".into())]
            ]
        );
    }
    #[test]
    fn multi_key_sort_and_exact_i64_ordering() {
        let fields = vec![
            field("id", Type::Int, false),
            field("grouping", Type::Int, true),
        ];
        let rows = vec![
            vec![I(i64::MAX), I(1)],
            vec![I(i64::MIN), I(1)],
            vec![I(0), N],
        ];
        assert_eq!(
            memory(
                &fields,
                rows,
                "SELECT id FROM t ORDER BY grouping ASC,id DESC"
            )
            .0,
            vec![vec![I(i64::MAX)], vec![I(i64::MIN)], vec![I(0)]]
        );
        assert_eq!(
            compare(&I(i64::MAX), &I(i64::MAX - 1)).unwrap(),
            Some(Ordering::Greater)
        );
    }
    #[test]
    fn text_sort_is_binary_not_locale_or_numeric() {
        let fields = vec![field("word", Type::Text, false)];
        let rows = ["가", "a", "Z", "A", "10", "2"]
            .into_iter()
            .map(|s| vec![T(s.into())])
            .collect();
        assert_eq!(
            memory(&fields, rows, "SELECT word FROM t ORDER BY word").0,
            ["10", "2", "A", "Z", "a", "가"]
                .into_iter()
                .map(|s| vec![T(s.into())])
                .collect::<Vec<_>>()
        );
    }
    #[test]
    fn named_insert_reorders_and_fills_nullable_columns() {
        let fields = vec![
            field("id", Type::Int, false),
            field("name", Type::Text, true),
            field("age", Type::Int, true),
        ];
        assert_eq!(
            bind_insert(
                &fields,
                Some(&["name".into(), "id".into()]),
                vec![T("Roy".into()), I(1)]
            )
            .unwrap(),
            vec![I(1), T("Roy".into()), N]
        );
        for (names, values) in [
            (vec!["name".into()], vec![T("Roy".into())]),
            (vec!["id".into(), "id".into()], vec![I(1), I(2)]),
            (vec!["unknown".into()], vec![I(1)]),
            (vec!["id".into()], vec![T("1".into())]),
        ] {
            assert!(bind_insert(&fields, Some(&names), values).is_err());
        }
    }
    #[test]
    fn create_policy_checked_before_store_open() {
        let temp = Temp::new();
        std::fs::create_dir_all(&temp.0).unwrap();
        let empty = temp.0.join("tables.pages");
        std::fs::write(&empty, b"").unwrap();
        assert!(storage::Store::open(&temp.0, false).is_err());
        assert_eq!(std::fs::metadata(&empty).unwrap().len(), 0);
        for sql in [
            "CREATE TABLE t(id INT)",
            "CREATE TABLE t(id TEXT NOT NULL)",
            "CREATE TABLE t(id INT NOT NULL,id TEXT)",
        ] {
            let Stmt::Create { table, fields } = language::ast(sql).unwrap() else {
                panic!()
            };
            assert!(validate_create(&table, &fields).is_err());
        }
    }
    #[test]
    fn sql_mutations_reopen_and_binding_failures_do_not_insert() {
        let t = Temp::new();
        let mut store = t.store();
        execute(
            &mut store,
            language::ast("CREATE TABLE people(id INT NOT NULL,name TEXT,age INT)").unwrap(),
        )
        .unwrap();
        execute(
            &mut store,
            language::ast("INSERT INTO people(name,id) VALUES('Roy',1)").unwrap(),
        )
        .unwrap();
        for sql in [
            "INSERT INTO people(id,missing) VALUES(2,'x')",
            "INSERT INTO people(id,id) VALUES(2,3)",
            "INSERT INTO people(name) VALUES('x')",
            "INSERT INTO people VALUES(2,'x','bad')",
            "INSERT INTO people VALUES(1,'duplicate',NULL)",
        ] {
            assert!(execute(&mut store, language::ast(sql).unwrap()).is_err());
        }
        drop(store);
        let mut store = storage::Store::open(&t.0, false).unwrap();
        let output = execute(&mut store, language::ast("SELECT * FROM people").unwrap()).unwrap();
        assert!(output.contains("\"scan_rows\":1"));
        assert!(output.contains("Roy"));
        assert!(!output.contains("duplicate"));
        assert!(
            execute(
                &mut store,
                language::ast("SELECT * FROM absent LIMIT 0").unwrap()
            )
            .is_err()
        );
    }
    #[test]
    fn genuine_scan_is_lazy_across_heap_pages() {
        let t = Temp::new();
        let mut store = t.store();
        let fields = vec![
            field("id", Type::Int, false),
            field("name", Type::Text, true),
        ];
        store.create("people", fields).unwrap();
        for n in 0..90 {
            store
                .insert("people", vec![I(n), T("x".repeat(200))])
                .unwrap();
        }
        store.corrupt_last_heap_header("people").unwrap();
        let stats = counters();
        let mut scan = store.scan("people", stats.clone()).unwrap();
        assert_eq!(stats.borrow().scan_rows, 0);
        assert_eq!(scan.next().unwrap().unwrap()[0], I(0));
        assert_eq!(stats.borrow().scan_rows, 1);
        let mut error = false;
        loop {
            match scan.next() {
                Ok(Some(_)) => {}
                Ok(None) => break,
                Err(_) => {
                    error = true;
                    break;
                }
            }
        }
        assert!(
            error,
            "later corruption should be seen only when the scan reaches it"
        );
    }
    #[test]
    fn stored_pipeline_stats_count_emitted_heap_rows() {
        let t = Temp::new();
        let mut store = t.store();
        execute(
            &mut store,
            language::ast("CREATE TABLE people(id INT NOT NULL,name TEXT,age INT,dept INT)")
                .unwrap(),
        )
        .unwrap();
        let (_, rows, _, _) = demo_data();
        for row in rows {
            store.insert("people", row).unwrap();
        }
        store.flush().unwrap();
        let result=execute(&mut store,language::ast("SELECT name,age FROM people WHERE age>=25 OR age IS NULL ORDER BY age DESC LIMIT 3").unwrap()).unwrap();
        assert!(
            result
                .contains("\"scan_rows\":5,\"filter_checks\":5,\"sort_rows\":4,\"output_rows\":3")
        );
        let zero = execute(
            &mut store,
            language::ast("SELECT * FROM people ORDER BY age LIMIT 0").unwrap(),
        )
        .unwrap();
        assert!(
            zero.contains("\"scan_rows\":0,\"filter_checks\":0,\"sort_rows\":0,\"output_rows\":0")
        );
    }
    fn join_rows(
        method: &str,
        left: Vec<Row>,
        right: Vec<Row>,
        keys: JoinKeys,
    ) -> io::Result<(Vec<Row>, Stats)> {
        let stats = counters();
        let left = Box::new(Values::new(left));
        let right = Box::new(Values::new(right));
        let op: Box<dyn Op> = if method == "nested" {
            Box::new(NestedJoin::new(left, right, keys, stats.clone()))
        } else {
            Box::new(HashJoin::new(left, right, keys, stats.clone()))
        };
        let rows = collect(op, &stats)?;
        let s = stats.borrow().clone();
        Ok((rows, s))
    }
    #[test]
    fn joins_keep_duplicate_matches_and_have_distinct_work_counters() {
        let (lf, left, rf, right) = demo_data();
        let keys = bind_join(&lf, &rf, 3, 0).unwrap();
        let (nested, ns) = join_rows("nested", left.clone(), right.clone(), keys).unwrap();
        let (hash, hs) = join_rows("hash", left, right, keys).unwrap();
        assert_eq!(nested, hash);
        assert_eq!(hash.len(), 5);
        assert_eq!(ns.join_checks, 25);
        assert_eq!(ns.output_rows, 5);
        assert_eq!(hs.join_checks, 0);
        assert_eq!(hs.hash_build, 4);
        assert_eq!(hs.hash_probe, 4);
        assert_eq!(hs.scan_rows, 0);
        assert_eq!(
            hash.iter()
                .map(|r| (r[1].clone(), r[5].clone()))
                .collect::<Vec<_>>(),
            [
                ("Roy", "Eng"),
                ("Roy", "Field"),
                ("Ana", "Ops"),
                ("Bo", "Eng"),
                ("Bo", "Field")
            ]
            .into_iter()
            .map(|(a, b)| (T(a.into()), T(b.into())))
            .collect::<Vec<_>>()
        );
    }
    #[test]
    fn joins_empty_inputs_null_keys_and_typed_keys() {
        let f = vec![field("keycol", Type::Int, true)];
        let keys = bind_join(&f, &f, 0, 0).unwrap();
        let left = vec![vec![I(1)], vec![I(1)], vec![N]];
        let right = vec![vec![I(1)], vec![I(1)], vec![N]];
        for method in ["nested", "hash"] {
            assert_eq!(
                join_rows(method, left.clone(), right.clone(), keys)
                    .unwrap()
                    .0
                    .len(),
                4
            );
            assert!(
                join_rows(method, vec![], right.clone(), keys)
                    .unwrap()
                    .0
                    .is_empty()
            );
            assert!(
                join_rows(method, left.clone(), vec![], keys)
                    .unwrap()
                    .0
                    .is_empty()
            );
        }
        assert!(bind_join(&f, &[field("keycol", Type::Text, true)], 0, 0).is_err());
        assert!(bind_join(&f, &f, 1, 0).is_err());
        assert!(join_rows("hash", vec![vec![T("1".into())]], right, keys).is_err());
    }
    #[test]
    fn text_key_join_retains_all_matches() {
        let f = vec![field("word", Type::Text, true)];
        let keys = bind_join(&f, &f, 0, 0).unwrap();
        let left = vec![vec![T("한글".into())], vec![N]];
        let right = vec![
            vec![T("한글".into())],
            vec![T("한글".into())],
            vec![T("other".into())],
        ];
        assert_eq!(
            join_rows("nested", left.clone(), right.clone(), keys)
                .unwrap()
                .0,
            join_rows("hash", left, right, keys).unwrap().0
        );
    }
    #[test]
    fn sort_and_join_buffers_have_hard_row_bounds() {
        let stats = counters();
        let mut sort = Sort {
            source: Box::new(Values::new(vec![vec![I(1)]; BUFFER_ROWS + 1])),
            keys: vec![SortKey {
                index: 0,
                kind: Type::Int,
                descending: false,
            }],
            rows: None,
            stats,
        };
        assert!(sort.next().unwrap_err().to_string().contains("sort buffer"));
        let keys = JoinKeys {
            left: 0,
            right: 0,
            kind: Type::Int,
        };
        assert!(
            join_rows("nested", vec![], vec![vec![N]; BUFFER_ROWS + 1], keys)
                .unwrap_err()
                .to_string()
                .contains("right buffer")
        );
        assert!(
            join_rows("hash", vec![], vec![vec![I(1)]; BUFFER_ROWS + 1], keys)
                .unwrap_err()
                .to_string()
                .contains("hash build")
        );
        let (_, stats) = join_rows(
            "hash",
            vec![vec![I(1)]],
            vec![vec![N]; BUFFER_ROWS + 1],
            keys,
        )
        .unwrap();
        assert_eq!(stats.hash_build, 0);
    }
    #[test]
    fn collector_bounds_duplicate_join_result_product() {
        let keys = JoinKeys {
            left: 0,
            right: 0,
            kind: Type::Int,
        };
        assert!(
            join_rows("hash", vec![vec![I(1)]; 101], vec![vec![I(1)]; 100], keys)
                .unwrap_err()
                .to_string()
                .contains("result buffer")
        );
    }
    #[test]
    fn zero_limit_also_avoids_join_build() {
        let stats = counters();
        let keys = JoinKeys {
            left: 0,
            right: 0,
            kind: Type::Int,
        };
        let join = HashJoin::new(Box::new(Bomb), Box::new(Bomb), keys, stats.clone());
        let limit = Limit {
            source: Box::new(join),
            remaining: 0,
        };
        assert!(collect(Box::new(limit), &stats).unwrap().is_empty());
        assert_eq!(*stats.borrow(), Stats::default());
    }
    #[test]
    fn output_preserves_i64_json_strings_and_null_kind() {
        let text = output(
            &["n".into()],
            &[vec![I(i64::MAX)], vec![N]],
            &Stats::default(),
        );
        assert!(text.contains("\"value\":\"9223372036854775807\""));
        assert!(text.contains("\"type\":\"null\""));
        assert!(join_demo("invalid").is_err());
    }
}
