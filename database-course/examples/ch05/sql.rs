use std::{
    fmt,
    io::{self, Read},
};
const MAX_BYTES: usize = 16384;
const MAX_TOKENS: usize = 1024;
const MAX_DEPTH: usize = 32;
const MAX_NODES: usize = 128;
const RESERVED: &[&str] = &[
    "create", "table", "int", "text", "not", "null", "insert", "into", "values", "select", "from",
    "where", "and", "or", "is", "order", "by", "asc", "desc", "limit", "join", "on", "as",
    "update", "delete", "drop", "primary", "key", "true", "false",
];
#[derive(Debug, Clone, PartialEq)]
struct Error {
    pos: usize,
    message: String,
}
impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "ERROR byte={}: {}", self.pos, self.message)
    }
}
impl std::error::Error for Error {}
type Result<T> = std::result::Result<T, Error>;
fn error(pos: usize, message: &str) -> Error {
    Error {
        pos,
        message: message.into(),
    }
}
#[derive(Debug, Clone, PartialEq)]
enum Kind {
    Word(String),
    Int(i64),
    Text(String),
    Sym(String),
    Eof,
}
#[derive(Debug, Clone, PartialEq)]
struct Token {
    kind: Kind,
    start: usize,
    end: usize,
}
fn lex(sql: &str) -> Result<Vec<Token>> {
    if sql.len() > MAX_BYTES {
        return Err(error(MAX_BYTES, "SQL exceeds 16384 UTF-8 bytes"));
    }
    let b = sql.as_bytes();
    let mut i = 0;
    let mut tokens = vec![];
    while i < b.len() {
        if b[i].is_ascii_whitespace() {
            i += 1;
            continue;
        }
        if b[i..].starts_with(b"--") {
            while i < b.len() && b[i] != b'\n' {
                i += 1;
            }
            continue;
        }
        let start = i;
        let kind = if b[i].is_ascii_alphabetic() || b[i] == b'_' {
            i += 1;
            while i < b.len() && (b[i].is_ascii_alphanumeric() || b[i] == b'_') {
                i += 1;
            }
            Kind::Word(sql[start..i].to_ascii_lowercase())
        } else if b[i].is_ascii_digit()
            || (b[i] == b'-' && b.get(i + 1).is_some_and(u8::is_ascii_digit))
        {
            i += 1;
            while i < b.len() && b[i].is_ascii_digit() {
                i += 1;
            }
            Kind::Int(
                sql[start..i]
                    .parse()
                    .map_err(|_| error(start, "integer is outside i64"))?,
            )
        } else if b[i] == b'\'' {
            i += 1;
            let mut text = String::new();
            let mut closed = false;
            while i < b.len() {
                if b[i] == b'\'' {
                    if b.get(i + 1) == Some(&b'\'') {
                        text.push('\'');
                        i += 2;
                        continue;
                    }
                    i += 1;
                    closed = true;
                    break;
                }
                let ch = sql[i..].chars().next().unwrap();
                text.push(ch);
                i += ch.len_utf8();
            }
            if !closed {
                return Err(error(start, "unterminated string"));
            }
            Kind::Text(text)
        } else {
            let two = b.get(i..i + 2);
            if two.is_some_and(|s| [b"<=".as_slice(), b">=", b"<>", b"!="].contains(&s)) {
                i += 2;
                Kind::Sym(sql[start..i].into())
            } else if b"(),;*=<>".contains(&b[i]) {
                i += 1;
                Kind::Sym(sql[start..i].into())
            } else {
                return Err(error(start, "unsupported character"));
            }
        };
        tokens.push(Token {
            kind,
            start,
            end: i,
        });
        if tokens.len() > MAX_TOKENS {
            return Err(error(start, "more than 1024 tokens"));
        }
    }
    tokens.push(Token {
        kind: Kind::Eof,
        start: i,
        end: i,
    });
    Ok(tokens)
}
#[derive(Debug, Clone, PartialEq)]
enum Literal {
    Int(i64),
    Text(String),
    Null,
}
#[derive(Debug, Clone, PartialEq)]
enum Operand {
    Column(String),
    Value(Literal),
}
#[derive(Debug, Clone, PartialEq)]
enum Compare {
    Eq,
    Ne,
    Lt,
    Le,
    Gt,
    Ge,
}
#[derive(Debug, Clone, PartialEq)]
enum Expr {
    Compare {
        left: Operand,
        op: Compare,
        right: Operand,
    },
    IsNull {
        value: Operand,
        negated: bool,
    },
    Not(Box<Expr>),
    And(Box<Expr>, Box<Expr>),
    Or(Box<Expr>, Box<Expr>),
}
#[derive(Debug, Clone, PartialEq)]
struct Column {
    name: String,
    data_type: String,
    nullable: bool,
}
#[derive(Debug, Clone, PartialEq)]
struct Order {
    column: String,
    descending: bool,
}
#[derive(Debug, Clone, PartialEq)]
enum Statement {
    Create {
        table: String,
        columns: Vec<Column>,
    },
    Insert {
        table: String,
        columns: Option<Vec<String>>,
        values: Vec<Literal>,
    },
    Select {
        table: String,
        columns: Option<Vec<String>>,
        filter: Option<Expr>,
        order: Vec<Order>,
        limit: Option<i64>,
    },
}
struct Parser {
    tokens: Vec<Token>,
    at: usize,
    nodes: usize,
}
impl Parser {
    fn current(&self) -> &Token {
        &self.tokens[self.at]
    }
    fn fail<T>(&self, message: &str) -> Result<T> {
        Err(error(self.current().start, message))
    }
    fn word(&mut self, s: &str) -> bool {
        if matches!(&self.current().kind,Kind::Word(w) if w==s) {
            self.at += 1;
            true
        } else {
            false
        }
    }
    fn sym(&mut self, s: &str) -> bool {
        if matches!(&self.current().kind,Kind::Sym(w) if w==s) {
            self.at += 1;
            true
        } else {
            false
        }
    }
    fn expect_word(&mut self, s: &str) -> Result<()> {
        if self.word(s) {
            Ok(())
        } else {
            self.fail(&format!("expected {s}"))
        }
    }
    fn expect_sym(&mut self, s: &str) -> Result<()> {
        if self.sym(s) {
            Ok(())
        } else {
            self.fail(&format!("expected {s}"))
        }
    }
    fn name(&mut self) -> Result<String> {
        if let Kind::Word(s) = &self.current().kind {
            if s.len() <= 32
                && s.as_bytes()[0].is_ascii_alphabetic()
                && !RESERVED.contains(&s.as_str())
            {
                let name = s.clone();
                self.at += 1;
                return Ok(name);
            }
        }
        self.fail("expected identifier (letter first, at most 32 bytes; no reserved word)")
    }
    fn names(&mut self) -> Result<Vec<String>> {
        let mut out = vec![self.name()?];
        while self.sym(",") {
            out.push(self.name()?);
        }
        Ok(out)
    }
    fn literal(&mut self) -> Result<Literal> {
        let value = match &self.current().kind {
            Kind::Int(n) => Literal::Int(*n),
            Kind::Text(s) => Literal::Text(s.clone()),
            Kind::Word(s) if s == "null" => Literal::Null,
            _ => return self.fail("expected integer, string or NULL"),
        };
        self.at += 1;
        Ok(value)
    }
    fn operand(&mut self) -> Result<Operand> {
        if matches!(&self.current().kind, Kind::Int(_) | Kind::Text(_))
            || matches!(&self.current().kind,Kind::Word(s) if s=="null")
        {
            Ok(Operand::Value(self.literal()?))
        } else {
            Ok(Operand::Column(self.name()?))
        }
    }
    fn node(&mut self, e: Expr) -> Result<Expr> {
        self.nodes += 1;
        if self.nodes > MAX_NODES {
            self.fail("more than 128 expression nodes")
        } else {
            Ok(e)
        }
    }
    fn expr(&mut self, depth: usize) -> Result<Expr> {
        let mut e = self.and(depth)?;
        while self.word("or") {
            let right = self.and(depth)?;
            e = self.node(Expr::Or(Box::new(e), Box::new(right)))?;
        }
        Ok(e)
    }
    fn and(&mut self, depth: usize) -> Result<Expr> {
        let mut e = self.not(depth)?;
        while self.word("and") {
            let right = self.not(depth)?;
            e = self.node(Expr::And(Box::new(e), Box::new(right)))?;
        }
        Ok(e)
    }
    fn not(&mut self, depth: usize) -> Result<Expr> {
        if depth > MAX_DEPTH {
            return self.fail("expression nesting exceeds 32");
        }
        if self.word("not") {
            let child = self.not(depth + 1)?;
            return self.node(Expr::Not(Box::new(child)));
        }
        if self.sym("(") {
            let child = self.expr(depth + 1)?;
            self.expect_sym(")")?;
            return Ok(child);
        }
        let left = self.operand()?;
        if self.word("is") {
            let negated = self.word("not");
            self.expect_word("null")?;
            return self.node(Expr::IsNull {
                value: left,
                negated,
            });
        }
        let op = match &self.current().kind {
            Kind::Sym(s) => match s.as_str() {
                "=" => Compare::Eq,
                "<>" | "!=" => Compare::Ne,
                "<" => Compare::Lt,
                "<=" => Compare::Le,
                ">" => Compare::Gt,
                ">=" => Compare::Ge,
                _ => return self.fail("expected comparison or IS [NOT] NULL"),
            },
            _ => return self.fail("expected comparison or IS [NOT] NULL"),
        };
        self.at += 1;
        let right = self.operand()?;
        self.node(Expr::Compare { left, op, right })
    }
    fn statement(&mut self) -> Result<Statement> {
        let stmt = if self.word("create") {
            self.expect_word("table")?;
            let table = self.name()?;
            self.expect_sym("(")?;
            let mut columns = vec![];
            loop {
                let name = self.name()?;
                let data_type = if self.word("int") {
                    "int"
                } else if self.word("text") {
                    "text"
                } else {
                    return self.fail("expected INT or TEXT");
                }
                .into();
                let nullable = if self.word("not") {
                    self.expect_word("null")?;
                    false
                } else {
                    true
                };
                columns.push(Column {
                    name,
                    data_type,
                    nullable,
                });
                if !self.sym(",") {
                    break;
                }
            }
            self.expect_sym(")")?;
            Statement::Create { table, columns }
        } else if self.word("insert") {
            self.expect_word("into")?;
            let table = self.name()?;
            let columns = if self.sym("(") {
                let c = self.names()?;
                self.expect_sym(")")?;
                Some(c)
            } else {
                None
            };
            self.expect_word("values")?;
            self.expect_sym("(")?;
            let mut values = vec![self.literal()?];
            while self.sym(",") {
                values.push(self.literal()?);
            }
            self.expect_sym(")")?;
            Statement::Insert {
                table,
                columns,
                values,
            }
        } else if self.word("select") {
            let columns = if self.sym("*") {
                None
            } else {
                Some(self.names()?)
            };
            self.expect_word("from")?;
            let table = self.name()?;
            let filter = if self.word("where") {
                Some(self.expr(0)?)
            } else {
                None
            };
            let mut order = vec![];
            if self.word("order") {
                self.expect_word("by")?;
                loop {
                    let column = self.name()?;
                    let descending = if self.word("desc") {
                        true
                    } else {
                        self.word("asc");
                        false
                    };
                    order.push(Order { column, descending });
                    if !self.sym(",") {
                        break;
                    }
                }
            }
            let limit = if self.word("limit") {
                let Kind::Int(n) = self.current().kind else {
                    return self.fail("expected nonnegative LIMIT");
                };
                if n < 0 {
                    return self.fail("expected nonnegative LIMIT");
                }
                self.at += 1;
                Some(n)
            } else {
                None
            };
            Statement::Select {
                table,
                columns,
                filter,
                order,
                limit,
            }
        } else {
            return self.fail("expected CREATE, INSERT or SELECT");
        };
        self.sym(";");
        if self.current().kind != Kind::Eof {
            return self.fail("expected end of input (one statement only)");
        }
        Ok(stmt)
    }
}
fn parse(sql: &str) -> Result<Statement> {
    Parser {
        tokens: lex(sql)?,
        at: 0,
        nodes: 0,
    }
    .statement()
}
// Stable JSON output for comparing the browser parser with this Rust parser.
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
fn array(items: impl IntoIterator<Item = String>) -> String {
    format!("[{}]", items.into_iter().collect::<Vec<_>>().join(","))
}
impl Literal {
    fn json(&self) -> String {
        match self {
            Self::Int(n) => format!("{{\"type\":\"int\",\"value\":{}}}", quote(&n.to_string())),
            Self::Text(s) => format!("{{\"type\":\"text\",\"value\":{}}}", quote(s)),
            Self::Null => "{\"type\":\"null\"}".into(),
        }
    }
}
impl Operand {
    fn json(&self) -> String {
        match self {
            Self::Column(s) => format!("{{\"type\":\"column\",\"name\":{}}}", quote(s)),
            Self::Value(v) => v.json(),
        }
    }
}
impl Expr {
    fn json(&self) -> String {
        match self {
            Self::Compare { left, op, right } => format!(
                "{{\"type\":\"compare\",\"op\":{},\"left\":{},\"right\":{}}}",
                quote(match op {
                    Compare::Eq => "=",
                    Compare::Ne => "!=",
                    Compare::Lt => "<",
                    Compare::Le => "<=",
                    Compare::Gt => ">",
                    Compare::Ge => ">=",
                }),
                left.json(),
                right.json()
            ),
            Self::IsNull { value, negated } => format!(
                "{{\"type\":\"is_null\",\"negated\":{negated},\"value\":{}}}",
                value.json()
            ),
            Self::Not(child) => format!("{{\"type\":\"not\",\"value\":{}}}", child.json()),
            Self::And(a, b) | Self::Or(a, b) => format!(
                "{{\"type\":{},\"left\":{},\"right\":{}}}",
                quote(if matches!(self, Self::And(..)) {
                    "and"
                } else {
                    "or"
                }),
                a.json(),
                b.json()
            ),
        }
    }
}
impl Statement {
    fn json(&self) -> String {
        match self {
            Self::Create { table, columns } => format!(
                "{{\"type\":\"create\",\"table\":{},\"columns\":{}}}",
                quote(table),
                array(columns.iter().map(|c| format!(
                    "{{\"name\":{},\"data_type\":{},\"nullable\":{}}}",
                    quote(&c.name),
                    quote(&c.data_type),
                    c.nullable
                )))
            ),
            Self::Insert {
                table,
                columns,
                values,
            } => format!(
                "{{\"type\":\"insert\",\"table\":{},\"columns\":{},\"values\":{}}}",
                quote(table),
                columns
                    .as_ref()
                    .map(|cols| array(cols.iter().map(|s| quote(s))))
                    .unwrap_or_else(|| "null".into()),
                array(values.iter().map(Literal::json))
            ),
            Self::Select {
                table,
                columns,
                filter,
                order,
                limit,
            } => format!(
                "{{\"type\":\"select\",\"table\":{},\"columns\":{},\"filter\":{},\"order\":{},\"limit\":{}}}",
                quote(table),
                columns
                    .as_ref()
                    .map(|cols| array(cols.iter().map(|s| quote(s))))
                    .unwrap_or_else(|| "null".into()),
                filter
                    .as_ref()
                    .map(Expr::json)
                    .unwrap_or_else(|| "null".into()),
                array(order.iter().map(|o| format!(
                    "{{\"column\":{},\"descending\":{}}}",
                    quote(&o.column),
                    o.descending
                ))),
                limit
                    .map(|n| quote(&n.to_string()))
                    .unwrap_or_else(|| "null".into())
            ),
        }
    }
}
fn tokens_json(tokens: &[Token]) -> String {
    array(tokens.iter().map(|t| {
        let (kind, value) = match &t.kind {
            Kind::Word(s) => ("word", quote(s)),
            Kind::Int(n) => ("int", quote(&n.to_string())),
            Kind::Text(s) => ("text", quote(s)),
            Kind::Sym(s) => ("symbol", quote(s)),
            Kind::Eof => ("eof", "null".into()),
        };
        format!(
            "{{\"kind\":{},\"value\":{},\"start\":{},\"end\":{}}}",
            quote(kind),
            value,
            t.start,
            t.end
        )
    }))
}
fn main() {
    let args: Vec<_> = std::env::args().skip(1).collect();
    if !args.is_empty() && args != ["--tokens"] {
        eprintln!("usage: sql [--tokens] < input.sql");
        std::process::exit(2);
    }
    let mut bytes = Vec::new();
    if let Err(e) = io::stdin()
        .take((MAX_BYTES + 1) as u64)
        .read_to_end(&mut bytes)
    {
        eprintln!("input error: {e}");
        std::process::exit(2);
    }
    if bytes.len() > MAX_BYTES {
        eprintln!("{}", error(MAX_BYTES, "SQL exceeds 16384 UTF-8 bytes"));
        std::process::exit(2);
    }
    let sql = match String::from_utf8(bytes) {
        Ok(sql) => sql,
        Err(e) => {
            eprintln!("input error: {e}");
            std::process::exit(2);
        }
    };
    let result = if args.is_empty() {
        parse(&sql).map(|s| s.json())
    } else {
        lex(&sql).map(|t| tokens_json(&t))
    };
    match result {
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
    fn filter(sql: &str) -> Expr {
        let Statement::Select {
            filter: Some(e), ..
        } = parse(sql).unwrap()
        else {
            panic!("expected filter")
        };
        e
    }
    #[test]
    fn token_spans_use_utf8_bytes() {
        let sql = "SELECT name FROM people WHERE name = '한글';";
        let tokens = lex(sql).unwrap();
        let text = tokens
            .iter()
            .find(|t| matches!(t.kind, Kind::Text(_)))
            .unwrap();
        let start = sql.find('\'').unwrap();
        assert_eq!((text.start, text.end), (start, start + 8));
        assert_eq!(&sql[text.start..text.end], "'한글'");
        assert_eq!(tokens.last().unwrap().start, sql.len());
    }
    #[test]
    fn words_fold_but_strings_do_not() {
        let Statement::Insert { table, values, .. } =
            parse("iNsErT InTo People VaLuEs (1, 'Roy Choi', NULL)").unwrap()
        else {
            panic!()
        };
        assert_eq!(table, "people");
        assert_eq!(
            values,
            vec![
                Literal::Int(1),
                Literal::Text("Roy Choi".into()),
                Literal::Null
            ]
        );
    }
    #[test]
    fn quote_escape_and_comment() {
        let stmt =
            parse("-- prefix\nINSERT INTO t VALUES ('O''Reilly', '--not comment;'); -- tail")
                .unwrap();
        let Statement::Insert { values, .. } = stmt else {
            panic!()
        };
        assert_eq!(
            values,
            vec![
                Literal::Text("O'Reilly".into()),
                Literal::Text("--not comment;".into())
            ]
        );
        assert_eq!(lex("'a\\b'").unwrap()[0].kind, Kind::Text("a\\b".into()));
    }
    #[test]
    fn signed_integer_limits() {
        for n in [i64::MIN, i64::MAX, 0, -1] {
            let Statement::Insert { values, .. } =
                parse(&format!("INSERT INTO t VALUES ({n})")).unwrap()
            else {
                panic!()
            };
            assert_eq!(values, vec![Literal::Int(n)]);
        }
        for s in ["9223372036854775808", "-9223372036854775809"] {
            assert!(lex(s).is_err());
        }
    }
    #[test]
    fn two_character_operators_are_single_tokens() {
        let tokens = lex("<= >= <> != < > =").unwrap();
        assert_eq!(tokens.len(), 8);
        for (t, s) in tokens.iter().zip(["<=", ">=", "<>", "!=", "<", ">", "="]) {
            assert_eq!(t.kind, Kind::Sym(s.into()));
        }
    }
    #[test]
    fn create_schema_defaults() {
        let Statement::Create { table, columns } =
            parse("CREATE TABLE People (id INT NOT NULL, name TEXT, age INT)").unwrap()
        else {
            panic!()
        };
        assert_eq!(table, "people");
        assert_eq!(columns.len(), 3);
        assert!(!columns[0].nullable);
        assert!(columns[1].nullable);
        assert_eq!(columns[1].data_type, "text");
    }
    #[test]
    fn insert_optional_column_list() {
        let Statement::Insert {
            columns, values, ..
        } = parse("INSERT INTO people (name,id) VALUES ('Roy',1);").unwrap()
        else {
            panic!()
        };
        assert_eq!(columns, Some(vec!["name".into(), "id".into()]));
        assert_eq!(values.len(), 2);
    }
    #[test]
    fn select_projection_sort_limit() {
        let Statement::Select {
            columns,
            filter,
            order,
            limit,
            ..
        } = parse("SELECT id,name FROM people ORDER BY age DESC,id ASC LIMIT 0").unwrap()
        else {
            panic!()
        };
        assert_eq!(columns, Some(vec!["id".into(), "name".into()]));
        assert_eq!(filter, None);
        assert_eq!(
            order,
            vec![
                Order {
                    column: "age".into(),
                    descending: true
                },
                Order {
                    column: "id".into(),
                    descending: false
                }
            ]
        );
        assert_eq!(limit, Some(0));
        let Statement::Select { columns, .. } = parse("SELECT * FROM people").unwrap() else {
            panic!()
        };
        assert_eq!(columns, None);
    }
    #[test]
    fn and_binds_before_or() {
        let e = filter("SELECT * FROM t WHERE a=1 OR b=2 AND c=3");
        let Expr::Or(left, right) = e else { panic!() };
        assert!(matches!(*left, Expr::Compare { .. }));
        assert!(matches!(*right, Expr::And(..)));
    }
    #[test]
    fn parentheses_override_precedence() {
        let Expr::And(left, _) = filter("SELECT * FROM t WHERE (a=1 OR b=2) AND c=3") else {
            panic!()
        };
        assert!(matches!(*left, Expr::Or(..)));
    }
    #[test]
    fn not_and_is_not_null() {
        let Expr::And(left, right) = filter("SELECT * FROM t WHERE NOT a=1 AND b IS NOT NULL")
        else {
            panic!()
        };
        assert!(matches!(*left, Expr::Not(_)));
        assert!(matches!(*right, Expr::IsNull { negated: true, .. }));
        assert!(matches!(
            filter("SELECT * FROM t WHERE a IS NULL"),
            Expr::IsNull { negated: false, .. }
        ));
    }
    #[test]
    fn all_comparison_operators() {
        for s in ["=", "!=", "<>", "<", "<=", ">", ">="] {
            assert!(matches!(
                filter(&format!("SELECT * FROM t WHERE a{s}1")),
                Expr::Compare { .. }
            ));
        }
        assert_eq!(
            filter("SELECT * FROM t WHERE a<>1"),
            filter("SELECT * FROM t WHERE a!=1")
        );
    }
    #[test]
    fn malformed_grammar_rejected() {
        for sql in [
            "",
            "SELECT FROM t",
            "SELECT a, FROM t",
            "SELECT * t",
            "SELECT * FROM t WHERE a",
            "SELECT * FROM t WHERE a=1<2",
            "SELECT * FROM t WHERE (a=1",
            "INSERT INTO t VALUES ()",
            "INSERT INTO t VALUES (1,)",
            "CREATE TABLE t ()",
            "CREATE TABLE t (id FLOAT)",
            "SELECT * FROM t LIMIT -1",
            "SELECT * FROM t LIMIT NULL",
        ] {
            assert!(parse(sql).is_err(), "accepted {sql}");
        }
    }
    #[test]
    fn no_partial_or_multiple_statements() {
        for sql in [
            "SELECT * FROM t; DROP TABLE t;",
            "SELECT * FROM t;;",
            "SELECT * FROM t nonsense",
            "INSERT INTO t VALUES(1),(2)",
            "SELECT * FROM t JOIN x ON t=x",
        ] {
            assert!(parse(sql).is_err(), "accepted {sql}");
        }
    }
    #[test]
    fn unsupported_lexical_forms_rejected() {
        for sql in [
            "'unterminated",
            "SELECT \"Name\" FROM t",
            "SELECT * FROM 한글",
            "SELECT * FROM t /* comment */",
            "SELECT * FROM t WHERE a=1.5",
            "SELECT * FROM t WHERE a=+1",
        ] {
            assert!(parse(sql).is_err());
        }
        assert!(parse("SELECT _name FROM t").is_err());
        assert!(parse("SELECT select FROM t").is_err());
        assert!(parse(&format!("SELECT {} FROM t", "a".repeat(33))).is_err());
    }
    #[test]
    fn syntax_does_not_bind_to_catalog() {
        assert!(parse("SELECT unknown FROM absent WHERE unknown='text'").is_ok());
        assert!(parse("CREATE TABLE t (id INT, id TEXT)").is_ok());
        assert!(parse("INSERT INTO t (id,name) VALUES (1)").is_ok());
    }
    #[test]
    fn error_positions_are_exact() {
        let sql = "SELECT name FROM people WHERE name = '한글' AND ;";
        let e = parse(sql).unwrap_err();
        assert_eq!(e.pos, sql.rfind(';').unwrap());
        let e = lex("INSERT INTO t VALUES ('oops)").unwrap_err();
        assert_eq!(e.pos, 22);
        assert_eq!(parse("SELECT * FROM").unwrap_err().pos, 13);
    }
    #[test]
    fn resource_limits_fail_cleanly() {
        assert!(lex(&" ".repeat(MAX_BYTES + 1)).is_err());
        assert!(lex(&"x ".repeat(MAX_TOKENS + 1)).is_err());
        let sql = format!(
            "SELECT * FROM t WHERE {}a=1{}",
            "(".repeat(34),
            ")".repeat(34)
        );
        assert!(parse(&sql).unwrap_err().message.contains("nesting"));
        let sql = format!("SELECT * FROM t WHERE {}a=1", "NOT ".repeat(34));
        assert!(parse(&sql).is_err());
        let sql = format!("SELECT * FROM t WHERE {}", vec!["a=1"; 70].join(" OR "));
        assert!(parse(&sql).unwrap_err().message.contains("128"));
    }
    #[test]
    fn json_preserves_literals_and_escapes_controls() {
        assert_eq!(quote("\0\n\t\"\\한글"), "\"\\u0000\\n\\t\\\"\\\\한글\"");
        let json = parse("INSERT INTO t VALUES (9223372036854775807,'한글',NULL)")
            .unwrap()
            .json();
        assert!(json.contains("\"value\":\"9223372036854775807\""));
        assert!(json.contains("한글"));
        assert!(json.contains("\"type\":\"null\""));
    }
}
