use std::{
    collections::{HashMap, HashSet},
    io::{self, BufRead},
    path::{Path, PathBuf},
};
// Keep the previous chapters unchanged; expose only the operations this layer needs.
#[allow(dead_code)]
mod index {
    include!("../ch03/btree.rs");
    pub struct Index(Tree);
    impl Index {
        pub fn open(path: &Path) -> io::Result<Self> {
            Ok(Self(Tree::open(path, 3, 3)?))
        }
        pub fn get(&mut self, key: i64) -> io::Result<Option<i64>> {
            self.0.get(key)
        }
        pub fn set(&mut self, key: i64, rid: i64) -> io::Result<()> {
            self.0.set(key, rid)
        }
        pub fn flush(&mut self) -> io::Result<()> {
            self.0.flush()
        }
    }
}
#[allow(dead_code)]
mod heap {
    include!("../ch02/pages.rs");
    pub struct Heap(Pool);
    impl Heap {
        pub fn open(path: &Path) -> io::Result<Self> {
            Ok(Self(Pool::new(Disk::open(path)?, 3)?))
        }
        pub fn len(&self) -> u64 {
            self.0.disk.pages
        }
        pub fn allocate(&mut self, metadata: &[u8]) -> io::Result<u64> {
            let id = self.0.disk.allocate()?;
            self.replace(id, metadata)?;
            Ok(id)
        }
        pub fn replace(&mut self, id: u64, metadata: &[u8]) -> io::Result<()> {
            let mut p = Page::new();
            p.insert(metadata)?;
            let f = self.0.fetch(id)?;
            let frame = self.0.frames[f].as_mut().unwrap();
            frame.page = p;
            frame.dirty = true;
            self.0.unpin(f)
        }
        pub fn read(&mut self, id: u64, slot: u16) -> io::Result<Vec<u8>> {
            let f = self.0.fetch(id)?;
            let result = self
                .0
                .get(f, slot)
                .and_then(|b| b.map(<[u8]>::to_vec).ok_or_else(|| invalid("missing slot")));
            self.0.unpin(f)?;
            result
        }
        pub fn append(&mut self, id: u64, bytes: &[u8]) -> io::Result<Option<u16>> {
            let f = self.0.fetch(id)?;
            let free = self.0.frames[f].as_ref().unwrap().page.free();
            let result = if bytes.len() + 4 > free {
                Ok(None)
            } else {
                self.0.insert(f, bytes).map(Some)
            };
            self.0.unpin(f)?;
            result
        }
        pub fn count(&mut self, id: u64) -> io::Result<usize> {
            let f = self.0.fetch(id)?;
            let n = self.0.frames[f].as_ref().unwrap().page.count();
            self.0.unpin(f)?;
            Ok(n)
        }
        pub fn next(&mut self, id: u64) -> io::Result<u64> {
            let b = self.read(id, 0)?;
            if b.len() != 8 {
                return Err(invalid("bad heap header"));
            }
            let next = u64::from_le_bytes(b.try_into().unwrap());
            if next >= self.len() && next != 0 {
                return Err(invalid("bad next page"));
            }
            Ok(next)
        }
        pub fn link(&mut self, id: u64, next: u64) -> io::Result<()> {
            self.next(id)?;
            let f = self.0.fetch(id)?;
            let frame = self.0.frames[f].as_mut().unwrap();
            let start = frame.page.u16(8);
            frame.page.0[start..start + 8].copy_from_slice(&next.to_le_bytes());
            frame.dirty = true;
            self.0.unpin(f)
        }
        pub fn flush(&mut self) -> io::Result<()> {
            self.0.flush()
        }
    }
}
const MAX_ROW: usize = 4072;
fn bad(message: &str) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidData, message)
}
#[derive(Debug, Clone, PartialEq)]
enum Kind {
    Int,
    Text,
}
#[derive(Debug, Clone, PartialEq)]
struct Column {
    name: String,
    kind: Kind,
    nullable: bool,
}
#[derive(Debug, Clone, PartialEq)]
enum Value {
    Int(i64),
    Text(String),
    Null,
}
type Row = Vec<Value>;
fn identifier(s: &str) -> bool {
    !s.is_empty()
        && s.len() <= 32
        && s.as_bytes()[0].is_ascii_alphabetic()
        && s.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'_')
}
fn validate_schema(schema: &[Column]) -> io::Result<()> {
    if schema.is_empty() || schema.len() > 16 || schema[0].kind != Kind::Int || schema[0].nullable {
        return Err(bad("first column must be non-null int; 1..16 columns"));
    }
    let mut names = HashSet::new();
    for c in schema {
        if !identifier(&c.name) || !names.insert(&c.name) {
            return Err(bad("bad or duplicate column name"));
        }
    }
    Ok(())
}
fn encode(schema: &[Column], row: &[Value]) -> io::Result<Vec<u8>> {
    if row.len() != schema.len() {
        return Err(bad("column count mismatch"));
    }
    let bitmap = schema.len().div_ceil(8);
    let fixed = 2 + bitmap + 8 * schema.len();
    let mut b = vec![0; fixed];
    b[..2].copy_from_slice(&(schema.len() as u16).to_le_bytes());
    for (i, (c, v)) in schema.iter().zip(row).enumerate() {
        let at = 2 + bitmap + i * 8;
        match (&c.kind, v) {
            (_, Value::Null) if c.nullable => b[2 + i / 8] |= 1 << (i % 8),
            (Kind::Int, Value::Int(n)) => b[at..at + 8].copy_from_slice(&n.to_le_bytes()),
            (Kind::Text, Value::Text(s)) => {
                if b.len() + s.len() > MAX_ROW {
                    return Err(bad("row too large"));
                }
                let offset = b.len() as u32;
                b[at..at + 4].copy_from_slice(&offset.to_le_bytes());
                b[at + 4..at + 8].copy_from_slice(&(s.len() as u32).to_le_bytes());
                b.extend_from_slice(s.as_bytes());
            }
            _ => return Err(bad("type or NOT NULL constraint")),
        }
    }
    if b.len() > MAX_ROW {
        return Err(bad("row too large"));
    }
    Ok(b)
}
fn decode(schema: &[Column], b: &[u8]) -> io::Result<Row> {
    let n = schema.len();
    let bitmap = n.div_ceil(8);
    let fixed = 2 + bitmap + 8 * n;
    if b.len() < fixed || b.len() > MAX_ROW || u16::from_le_bytes([b[0], b[1]]) as usize != n {
        return Err(bad("bad row size"));
    }
    if n % 8 != 0 && b[2 + bitmap - 1] >> (n % 8) != 0 {
        return Err(bad("unused NULL bits"));
    }
    let mut row = vec![];
    let mut end = fixed;
    for (i, c) in schema.iter().enumerate() {
        let at = 2 + bitmap + 8 * i;
        let cell = &b[at..at + 8];
        if b[2 + i / 8] & (1 << (i % 8)) != 0 {
            if !c.nullable || cell.iter().any(|&v| v != 0) {
                return Err(bad("bad NULL field"));
            }
            row.push(Value::Null);
            continue;
        }
        row.push(match c.kind {
            Kind::Int => Value::Int(i64::from_le_bytes(cell.try_into().unwrap())),
            Kind::Text => {
                let start = u32::from_le_bytes(cell[..4].try_into().unwrap()) as usize;
                let len = u32::from_le_bytes(cell[4..].try_into().unwrap()) as usize;
                let limit = start.checked_add(len).ok_or_else(|| bad("text overflow"))?;
                if start != end || limit > b.len() {
                    return Err(bad("bad text range"));
                }
                let s = std::str::from_utf8(&b[start..limit]).map_err(|_| bad("bad UTF-8"))?;
                end = limit;
                Value::Text(s.to_owned())
            }
        });
    }
    if end != b.len() {
        return Err(bad("trailing row bytes"));
    }
    Ok(row)
}
#[derive(Debug, Clone, PartialEq)]
struct Table {
    name: String,
    schema: Vec<Column>,
    first: u64,
    last: u64,
}
fn catalog(tables: &[Table]) -> io::Result<Vec<u8>> {
    if tables.len() > 32 {
        return Err(bad("at most 32 tables"));
    }
    let mut b = b"TB04".to_vec();
    b.extend_from_slice(&(tables.len() as u16).to_le_bytes());
    for t in tables {
        if !identifier(&t.name) {
            return Err(bad("bad table name"));
        }
        validate_schema(&t.schema)?;
        b.push(t.name.len() as u8);
        b.extend_from_slice(t.name.as_bytes());
        b.push(t.schema.len() as u8);
        for c in &t.schema {
            b.push(c.name.len() as u8);
            b.extend_from_slice(c.name.as_bytes());
            b.push(if c.kind == Kind::Int { 1 } else { 2 });
            b.push(c.nullable as u8);
        }
        b.extend_from_slice(&t.first.to_le_bytes());
        b.extend_from_slice(&t.last.to_le_bytes());
    }
    if b.len() > 4084 {
        return Err(bad("catalog page full"));
    }
    Ok(b)
}
struct Reader<'a> {
    bytes: &'a [u8],
    at: usize,
}
impl<'a> Reader<'a> {
    fn take(&mut self, n: usize) -> io::Result<&'a [u8]> {
        let end = self
            .at
            .checked_add(n)
            .ok_or_else(|| bad("catalog overflow"))?;
        let out = self
            .bytes
            .get(self.at..end)
            .ok_or_else(|| bad("truncated catalog"))?;
        self.at = end;
        Ok(out)
    }
    fn byte(&mut self) -> io::Result<u8> {
        Ok(self.take(1)?[0])
    }
    fn name(&mut self) -> io::Result<String> {
        let len = self.byte()? as usize;
        Ok(std::str::from_utf8(self.take(len)?)
            .map_err(|_| bad("bad name"))?
            .to_owned())
    }
    fn id(&mut self) -> io::Result<u64> {
        Ok(u64::from_le_bytes(self.take(8)?.try_into().unwrap()))
    }
}
fn read_catalog(b: &[u8], pages: u64) -> io::Result<Vec<Table>> {
    let mut r = Reader { bytes: b, at: 0 };
    if r.take(4)? != b"TB04" {
        return Err(bad("bad catalog magic"));
    }
    let n = u16::from_le_bytes(r.take(2)?.try_into().unwrap());
    if n > 32 {
        return Err(bad("too many tables"));
    }
    let mut tables = vec![];
    let mut names = HashSet::new();
    for _ in 0..n {
        let name = r.name()?;
        if !identifier(&name) || !names.insert(name.clone()) {
            return Err(bad("bad table name"));
        }
        let count = r.byte()?;
        if !(1..=16).contains(&count) {
            return Err(bad("bad column count"));
        }
        let mut schema = vec![];
        for _ in 0..count {
            let name = r.name()?;
            let kind = match r.byte()? {
                1 => Kind::Int,
                2 => Kind::Text,
                _ => return Err(bad("bad type")),
            };
            let nullable = match r.byte()? {
                0 => false,
                1 => true,
                _ => return Err(bad("bad nullability")),
            };
            schema.push(Column {
                name,
                kind,
                nullable,
            });
        }
        validate_schema(&schema)?;
        let first = r.id()?;
        let last = r.id()?;
        if first == 0 || last == 0 || first >= pages || last >= pages {
            return Err(bad("bad heap page id"));
        }
        tables.push(Table {
            name,
            schema,
            first,
            last,
        });
    }
    if r.at != b.len() {
        return Err(bad("trailing catalog bytes"));
    }
    Ok(tables)
}
fn pack(page: u64, slot: u16) -> io::Result<i64> {
    if page == 0 || page > (i64::MAX as u64 >> 16) || slot == 0 {
        return Err(bad("RID overflow or reserved slot"));
    }
    Ok(((page << 16) | slot as u64) as i64)
}
fn unpack(rid: i64) -> io::Result<(u64, u16)> {
    if rid < 0 {
        return Err(bad("negative RID"));
    }
    let page = rid as u64 >> 16;
    let slot = rid as u16;
    pack(page, slot)?;
    Ok((page, slot))
}
struct Db {
    dir: PathBuf,
    heap: heap::Heap,
    tables: Vec<Table>,
    indexes: HashMap<String, index::Index>,
}
impl Db {
    fn open(dir: &Path) -> io::Result<Self> {
        std::fs::create_dir_all(dir)?;
        let mut heap = heap::Heap::open(&dir.join("tables.pages"))?;
        if heap.len() == 0 {
            heap.allocate(&catalog(&[])?)?;
            heap.flush()?;
        }
        let tables = read_catalog(&heap.read(0, 0)?, heap.len())?;
        let mut indexes = HashMap::new();
        for t in &tables {
            let path = dir.join(format!("{}.idx", t.name));
            if !path.exists() || path.metadata()?.len() == 0 {
                return Err(bad("missing or empty index file"));
            }
            indexes.insert(t.name.clone(), index::Index::open(&path)?);
        }
        Ok(Self {
            dir: dir.to_owned(),
            heap,
            tables,
            indexes,
        })
    }
    fn table(&self, name: &str) -> io::Result<usize> {
        self.tables
            .iter()
            .position(|t| t.name == name)
            .ok_or_else(|| bad("unknown table"))
    }
    fn create(&mut self, name: &str, schema: Vec<Column>) -> io::Result<()> {
        if !identifier(name) || self.tables.iter().any(|t| t.name == name) {
            return Err(bad("bad or duplicate table name"));
        }
        validate_schema(&schema)?;
        let mut tables = self.tables.clone();
        tables.push(Table {
            name: name.to_owned(),
            schema,
            first: 1,
            last: 1,
        });
        catalog(&tables)?;
        let path = self.dir.join(format!("{name}.idx"));
        if path.exists() {
            return Err(bad("index file already exists"));
        }
        let id = self.heap.allocate(&0u64.to_le_bytes())?;
        let t = tables.last_mut().unwrap();
        t.first = id;
        t.last = id;
        let idx = index::Index::open(&path)?;
        self.heap.replace(0, &catalog(&tables)?)?;
        self.tables = tables;
        self.indexes.insert(name.to_owned(), idx);
        Ok(())
    }
    fn insert(&mut self, name: &str, row: Row) -> io::Result<(u64, u16)> {
        let i = self.table(name)?;
        let bytes = encode(&self.tables[i].schema, &row)?;
        let Value::Int(key) = row[0] else {
            return Err(bad("int primary key required"));
        };
        if self.indexes.get_mut(name).unwrap().get(key)?.is_some() {
            return Err(bad("duplicate primary key"));
        }
        let mut page = self.tables[i].last;
        let slot = match self.heap.append(page, &bytes)? {
            Some(slot) => slot,
            None => {
                let new = self.heap.allocate(&0u64.to_le_bytes())?;
                let slot = self
                    .heap
                    .append(new, &bytes)?
                    .ok_or_else(|| bad("row does not fit"))?;
                self.heap.link(page, new)?;
                self.tables[i].last = new;
                self.heap.replace(0, &catalog(&self.tables)?)?;
                page = new;
                slot
            }
        };
        self.indexes
            .get_mut(name)
            .unwrap()
            .set(key, pack(page, slot)?)?;
        Ok((page, slot))
    }
    fn get(&mut self, name: &str, key: i64) -> io::Result<Option<Row>> {
        let i = self.table(name)?;
        let Some(rid) = self.indexes.get_mut(name).unwrap().get(key)? else {
            return Ok(None);
        };
        let (page, slot) = unpack(rid)?;
        let row = decode(&self.tables[i].schema, &self.heap.read(page, slot)?)?;
        if row.first() != Some(&Value::Int(key)) {
            return Err(bad("index key and heap row disagree"));
        }
        Ok(Some(row))
    }
    fn scan(&mut self, name: &str) -> io::Result<Vec<Row>> {
        let i = self.table(name)?;
        let t = self.tables[i].clone();
        let mut page = t.first;
        let mut seen = HashSet::new();
        let mut rows = vec![];
        loop {
            if !seen.insert(page) {
                return Err(bad("cycle in heap chain"));
            }
            for slot in 1..self.heap.count(page)? {
                rows.push(decode(&t.schema, &self.heap.read(page, slot as u16)?)?);
            }
            let next = self.heap.next(page)?;
            if next == 0 {
                if page != t.last {
                    return Err(bad("bad last page"));
                }
                return Ok(rows);
            }
            page = next;
        }
    }
    fn flush(&mut self) -> io::Result<()> {
        self.heap.flush()?;
        for idx in self.indexes.values_mut() {
            idx.flush()?;
        }
        Ok(())
    }
}
fn parse_schema(fields: &[&str]) -> io::Result<Vec<Column>> {
    let mut schema = vec![];
    for f in fields {
        let (name, ty) = f
            .split_once(':')
            .ok_or_else(|| bad("column syntax: name:int or name:text?"))?;
        let nullable = ty.ends_with('?');
        let ty = ty.strip_suffix('?').unwrap_or(ty);
        let kind = match ty {
            "int" => Kind::Int,
            "text" => Kind::Text,
            _ => return Err(bad("unknown type")),
        };
        schema.push(Column {
            name: name.to_owned(),
            kind,
            nullable,
        });
    }
    validate_schema(&schema)?;
    Ok(schema)
}
fn display(row: &[Value]) -> String {
    row.iter()
        .map(|v| match v {
            Value::Int(n) => n.to_string(),
            Value::Text(s) => s.clone(),
            Value::Null => "NULL".into(),
        })
        .collect::<Vec<_>>()
        .join("|")
}
fn main() -> io::Result<()> {
    let dir = std::env::args()
        .nth(1)
        .ok_or_else(|| bad("usage: tables DIRECTORY"))?;
    let mut db = Db::open(Path::new(&dir))?;
    for line in io::stdin().lock().lines() {
        let line = line?;
        let parts: Vec<_> = line.split('|').collect();
        match parts.as_slice() {
            ["create", name, fields @ ..] => {
                db.create(name, parse_schema(fields)?)?;
                println!("CREATED");
            }
            ["insert", name, fields @ ..] => {
                let i = db.table(name)?;
                if fields.len() != db.tables[i].schema.len() {
                    return Err(bad("column count mismatch"));
                }
                let mut row = vec![];
                for (s, c) in fields.iter().zip(&db.tables[i].schema) {
                    row.push(if *s == "NULL" {
                        Value::Null
                    } else {
                        match c.kind {
                            Kind::Int => Value::Int(s.parse().map_err(|_| bad("expected i64"))?),
                            Kind::Text => Value::Text((*s).to_owned()),
                        }
                    });
                }
                let (page, slot) = db.insert(name, row)?;
                println!("RID {page}:{slot}");
            }
            ["get", name, key] => {
                let key = key.parse().map_err(|_| bad("expected i64"))?;
                println!(
                    "{}",
                    db.get(name, key)?
                        .map(|r| display(&r))
                        .unwrap_or_else(|| "(nil)".into())
                );
            }
            ["scan", name] => {
                for row in db.scan(name)? {
                    println!("{}", display(&row));
                }
            }
            [".flush"] => {
                db.flush()?;
                println!("FLUSHED");
            }
            [".exit"] => break,
            [""] => {}
            _ => {
                return Err(bad(
                    "commands: create|TABLE|COL:TYPE...; insert|TABLE|VALUE...; get|TABLE|KEY; scan|TABLE; .flush; .exit",
                ));
            }
        }
    }
    db.flush()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU64, Ordering};
    static SEQ: AtomicU64 = AtomicU64::new(0);
    struct Temp(PathBuf);
    impl Temp {
        fn new() -> Self {
            Self(std::env::temp_dir().join(format!(
                "mydb-ch04-{}-{}",
                std::process::id(),
                SEQ.fetch_add(1, Ordering::Relaxed)
            )))
        }
        fn db(&self) -> Db {
            Db::open(&self.0).unwrap()
        }
    }
    impl Drop for Temp {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }
    fn schema() -> Vec<Column> {
        parse_schema(&["id:int", "name:text", "age:int?"]).unwrap()
    }
    fn row(id: i64, name: &str) -> Row {
        vec![Value::Int(id), Value::Text(name.into()), Value::Null]
    }
    #[test]
    fn exact_row_bytes() {
        let b = encode(&schema(), &row(1, "Roy")).unwrap();
        assert_eq!(b.len(), 30);
        assert_eq!(&b[..3], &[3, 0, 4]);
        assert_eq!(&b[3..11], &1i64.to_le_bytes());
        assert_eq!(&b[11..19], &[27, 0, 0, 0, 3, 0, 0, 0]);
        assert_eq!(&b[19..27], &[0; 8]);
        assert_eq!(&b[27..], b"Roy");
        assert_eq!(decode(&schema(), &b).unwrap(), row(1, "Roy"));
    }
    #[test]
    fn empty_text_null_and_unicode_are_distinct() {
        let s = parse_schema(&["id:int", "text:text?"]).unwrap();
        for v in [
            Value::Text(String::new()),
            Value::Text("한글🙂".into()),
            Value::Text("NULL".into()),
            Value::Null,
        ] {
            let r = vec![Value::Int(-1), v];
            let b = encode(&s, &r).unwrap();
            assert_eq!(decode(&s, &b).unwrap(), r);
        }
        let null = encode(&s, &[Value::Int(1), Value::Null]).unwrap();
        let empty = encode(&s, &[Value::Int(1), Value::Text(String::new())]).unwrap();
        assert_ne!(null, empty);
        assert_eq!(null.len(), empty.len());
    }
    #[test]
    fn bitmap_crosses_byte_boundary() {
        let mut s = parse_schema(&["id:int"]).unwrap();
        for i in 1..10 {
            s.push(Column {
                name: format!("v{i}"),
                kind: Kind::Text,
                nullable: true,
            });
        }
        let mut r = vec![Value::Int(i64::MIN)];
        r.extend(vec![Value::Null; 9]);
        let b = encode(&s, &r).unwrap();
        assert_eq!(&b[2..4], &[0xfe, 3]);
        assert_eq!(decode(&s, &b).unwrap(), r);
    }
    #[test]
    fn invalid_rows_and_names_rejected() {
        assert!(encode(&schema(), &row(1, &"x".repeat(5000))).is_err());
        assert!(encode(&schema(), &[]).is_err());
        assert!(
            encode(
                &schema(),
                &[Value::Null, Value::Text("x".into()), Value::Null]
            )
            .is_err()
        );
        assert!(encode(&schema(), &[Value::Int(1), Value::Int(2), Value::Null]).is_err());
        for fields in [
            vec!["id:int?"],
            vec!["id:text"],
            vec!["id:int", "id:text"],
            vec!["../id:int"],
        ] {
            assert!(parse_schema(&fields).is_err());
        }
    }
    #[test]
    fn corrupt_rows_return_errors() {
        let s = schema();
        let b = encode(&s, &row(1, "Roy")).unwrap();
        for len in 0..b.len() {
            assert!(decode(&s, &b[..len]).is_err());
        }
        let mut x = b.clone();
        x[2] |= 0x80;
        assert!(decode(&s, &x).is_err());
        let mut x = b.clone();
        x[11..15].copy_from_slice(&u32::MAX.to_le_bytes());
        assert!(decode(&s, &x).is_err());
        let mut x = b.clone();
        x[27] = 0xff;
        assert!(decode(&s, &x).is_err());
        let mut x = b.clone();
        x[19] = 1;
        assert!(decode(&s, &x).is_err());
        let mut x = b;
        x.push(0);
        assert!(decode(&s, &x).is_err());
    }
    #[test]
    fn catalog_roundtrip_and_truncation() {
        let tables = vec![Table {
            name: "people".into(),
            schema: schema(),
            first: 1,
            last: 3,
        }];
        let b = catalog(&tables).unwrap();
        assert_eq!(&b[..6], b"TB04\x01\x00");
        assert_eq!(read_catalog(&b, 4).unwrap(), tables);
        for len in 0..b.len() {
            assert!(read_catalog(&b[..len], 4).is_err());
        }
        assert!(read_catalog(&b, 3).is_err());
        let mut dup = tables.clone();
        dup.push(tables[0].clone());
        assert!(read_catalog(&catalog(&dup).unwrap(), 4).is_err());
    }
    #[test]
    fn rid_roundtrip_and_limits() {
        assert_eq!(pack(1, 1).unwrap(), 65537);
        assert_eq!(unpack(65537).unwrap(), (1, 1));
        let page = i64::MAX as u64 >> 16;
        assert_eq!(
            unpack(pack(page, u16::MAX).unwrap()).unwrap(),
            (page, u16::MAX)
        );
        assert!(pack(page + 1, 1).is_err());
        assert!(pack(0, 1).is_err());
        assert!(pack(1, 0).is_err());
        assert!(unpack(-1).is_err());
    }
    #[test]
    fn duplicate_primary_key_does_not_append() {
        let f = Temp::new();
        let mut db = f.db();
        db.create("people", schema()).unwrap();
        assert_eq!(db.insert("people", row(1, "Roy")).unwrap(), (1, 1));
        assert!(db.insert("people", row(1, "Changed")).is_err());
        assert_eq!(db.scan("people").unwrap(), vec![row(1, "Roy")]);
        assert_eq!(db.heap.count(1).unwrap(), 2);
        assert!(db.get("people", 999).unwrap().is_none());
    }
    #[test]
    fn heap_growth_and_index_splits_survive_reopen() {
        let f = Temp::new();
        let mut db = f.db();
        db.create("people", schema()).unwrap();
        let text = "x".repeat(90);
        for id in (0..150).rev() {
            db.insert("people", row(id, &text)).unwrap();
        }
        assert!(db.tables[0].last > db.tables[0].first);
        assert_eq!(db.scan("people").unwrap().len(), 150);
        db.flush().unwrap();
        drop(db);
        let mut db = f.db();
        for id in 0..150 {
            assert_eq!(db.get("people", id).unwrap(), Some(row(id, &text)));
        }
        db.insert("people", row(200, "after reopen")).unwrap();
        assert_eq!(db.scan("people").unwrap().len(), 151);
        db.flush().unwrap();
    }
    #[test]
    fn independent_table_schemas_and_indexes() {
        let f = Temp::new();
        let mut db = f.db();
        db.create("people", schema()).unwrap();
        db.create("jobs", parse_schema(&["id:int", "cost:int"]).unwrap())
            .unwrap();
        db.insert("people", row(1, "Roy")).unwrap();
        db.insert("jobs", vec![Value::Int(1), Value::Int(800)])
            .unwrap();
        db.flush().unwrap();
        drop(db);
        let mut db = f.db();
        assert_eq!(db.tables.len(), 2);
        assert_eq!(db.get("people", 1).unwrap(), Some(row(1, "Roy")));
        assert_eq!(
            db.get("jobs", 1).unwrap(),
            Some(vec![Value::Int(1), Value::Int(800)])
        );
    }
    #[test]
    fn max_row_fits_empty_heap_page() {
        let f = Temp::new();
        let mut db = f.db();
        db.create("people", schema()).unwrap();
        let r = row(1, &"x".repeat(MAX_ROW - 27));
        assert_eq!(encode(&schema(), &r).unwrap().len(), MAX_ROW);
        db.insert("people", r.clone()).unwrap();
        assert_eq!(db.get("people", 1).unwrap(), Some(r));
        db.insert("people", row(2, "next page")).unwrap();
        assert_eq!(db.tables[0].last, 2);
    }
    #[test]
    fn missing_index_and_cyclic_chain_are_errors() {
        let f = Temp::new();
        let mut db = f.db();
        db.create("people", schema()).unwrap();
        db.heap.link(1, 1).unwrap();
        assert!(db.scan("people").is_err());
        db.flush().unwrap();
        drop(db);
        std::fs::remove_file(f.0.join("people.idx")).unwrap();
        assert!(Db::open(&f.0).is_err());
    }
    #[test]
    fn catalog_limit_rejects_before_allocation() {
        let f = Temp::new();
        let mut db = f.db();
        let mut s = parse_schema(&["id:int"]).unwrap();
        for i in 1..16 {
            s.push(Column {
                name: format!("long_column_name_{i:02}"),
                kind: Kind::Text,
                nullable: true,
            });
        }
        let mut rejected = false;
        for i in 0..33 {
            let before = db.heap.len();
            if db.create(&format!("table{i}"), s.clone()).is_err() {
                assert_eq!(db.heap.len(), before);
                rejected = true;
                break;
            }
        }
        assert!(rejected);
        db.flush().unwrap();
    }
    #[test]
    fn failed_heap_read_releases_pin() {
        let f = Temp::new();
        std::fs::create_dir_all(&f.0).unwrap();
        let mut h = heap::Heap::open(&f.0.join("heap")).unwrap();
        let id = h.allocate(&0u64.to_le_bytes()).unwrap();
        for _ in 0..5 {
            assert!(h.read(id, 1).is_err());
        }
        h.flush().unwrap();
        for _ in 0..5 {
            let id = h.allocate(&0u64.to_le_bytes()).unwrap();
            h.append(id, b"ok").unwrap();
        }
        h.flush().unwrap();
    }
}
