use std::{
    io::{self, BufRead},
    path::Path,
};

// Reuse Chapter 02 unchanged. This adapter owns every pin it obtains.
#[allow(dead_code)]
mod storage {
    include!("../ch02/pages.rs");
    pub struct Pager(Pool);
    impl Pager {
        pub fn open(path: &Path, capacity: usize) -> io::Result<Self> {
            Ok(Self(Pool::new(Disk::open(path)?, capacity)?))
        }
        pub fn len(&self) -> u64 {
            self.0.disk.pages
        }
        pub fn allocate(&mut self) -> io::Result<u64> {
            self.0.disk.allocate()
        }
        pub fn read(&mut self, id: u64) -> io::Result<Vec<u8>> {
            let f = self.0.fetch(id)?;
            let result = self.0.get(f, 0).and_then(|record| {
                record
                    .map(<[u8]>::to_vec)
                    .ok_or_else(|| invalid("missing slot zero"))
            });
            self.0.unpin(f)?;
            result
        }
        pub fn write(&mut self, id: u64, bytes: &[u8]) -> io::Result<()> {
            let mut page = Page::new();
            page.insert(bytes)?;
            let f = self.0.fetch(id)?;
            let frame = self.0.frames[f].as_mut().unwrap();
            frame.page = page;
            frame.dirty = true;
            self.0.unpin(f)
        }
        pub fn flush(&mut self) -> io::Result<()> {
            self.0.flush()
        }
    }
}
fn bad(message: &str) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidData, message)
}
#[derive(Debug, Clone, PartialEq)]
enum Node {
    Leaf { rows: Vec<(i64, i64)>, next: u64 },
    Branch { keys: Vec<i64>, children: Vec<u64> },
}
impl Node {
    fn encode(&self) -> Vec<u8> {
        let mut b = Vec::new();
        match self {
            Self::Leaf { rows, next } => {
                b.push(1);
                b.extend_from_slice(&(rows.len() as u16).to_le_bytes());
                b.extend_from_slice(&next.to_le_bytes());
                for (key, value) in rows {
                    b.extend_from_slice(&key.to_le_bytes());
                    b.extend_from_slice(&value.to_le_bytes());
                }
            }
            Self::Branch { keys, children } => {
                b.push(2);
                b.extend_from_slice(&(keys.len() as u16).to_le_bytes());
                b.extend_from_slice(&children[0].to_le_bytes());
                for (key, child) in keys.iter().zip(&children[1..]) {
                    b.extend_from_slice(&key.to_le_bytes());
                    b.extend_from_slice(&child.to_le_bytes());
                }
            }
        }
        b
    }
    fn decode(b: &[u8], max: usize, pages: u64) -> io::Result<Self> {
        if b.len() < 11 {
            return Err(bad("short node"));
        }
        let n = u16::from_le_bytes([b[1], b[2]]) as usize;
        if n > max || b.len() != 11 + 16 * n {
            return Err(bad("bad node size"));
        }
        let u64_at = |at| u64::from_le_bytes(b[at..at + 8].try_into().unwrap());
        let i64_at = |at| i64::from_le_bytes(b[at..at + 8].try_into().unwrap());
        let valid_id = |id| id > 0 && id < pages;
        let keys: Vec<_> = (0..n).map(|i| i64_at(11 + i * 16)).collect();
        if keys.windows(2).any(|w| w[0] >= w[1]) {
            return Err(bad("unsorted node"));
        }
        match b[0] {
            1 => {
                let next = u64_at(3);
                if next != 0 && !valid_id(next) {
                    return Err(bad("bad next leaf"));
                }
                let rows = keys
                    .into_iter()
                    .enumerate()
                    .map(|(i, k)| (k, i64_at(19 + i * 16)))
                    .collect();
                Ok(Self::Leaf { rows, next })
            }
            2 => {
                let mut children = vec![u64_at(3)];
                children.extend((0..n).map(|i| u64_at(19 + i * 16)));
                if n == 0 || children.iter().any(|&id| !valid_id(id)) {
                    return Err(bad("bad branch"));
                }
                Ok(Self::Branch { keys, children })
            }
            _ => Err(bad("unknown node kind")),
        }
    }
}
struct Tree {
    pager: storage::Pager,
    root: u64,
    max: usize,
}
impl Tree {
    fn open(path: &Path, max: usize, capacity: usize) -> io::Result<Self> {
        if !(3..=200).contains(&max) {
            return Err(bad("max_keys must be 3..200"));
        }
        let mut pager = storage::Pager::open(path, capacity)?;
        if pager.len() == 0 {
            pager.allocate()?; // page 0: metadata
            let root = pager.allocate()?;
            let mut t = Self { pager, root, max };
            t.save(
                root,
                &Node::Leaf {
                    rows: vec![],
                    next: 0,
                },
            )?;
            t.save_meta()?;
            t.flush()?;
            Ok(t)
        } else {
            let b = pager.read(0)?;
            if b.len() != 16 || &b[..4] != b"BT03" || b[6..8] != [0, 0] {
                return Err(bad("bad metadata"));
            }
            if u16::from_le_bytes([b[4], b[5]]) as usize != max {
                return Err(bad("max_keys mismatch"));
            }
            let root = u64::from_le_bytes(b[8..16].try_into().unwrap());
            if root == 0 || root >= pager.len() {
                return Err(bad("bad root"));
            }
            let mut t = Self { pager, root, max };
            t.load(root)?;
            Ok(t)
        }
    }
    fn save_meta(&mut self) -> io::Result<()> {
        let mut b = b"BT03".to_vec();
        b.extend_from_slice(&(self.max as u16).to_le_bytes());
        b.extend_from_slice(&[0, 0]);
        b.extend_from_slice(&self.root.to_le_bytes());
        self.pager.write(0, &b)
    }
    fn load(&mut self, id: u64) -> io::Result<Node> {
        if id == 0 {
            return Err(bad("metadata is not a node"));
        }
        Node::decode(&self.pager.read(id)?, self.max, self.pager.len())
    }
    fn save(&mut self, id: u64, node: &Node) -> io::Result<()> {
        self.pager.write(id, &node.encode())
    }
    fn new_node(&mut self, node: &Node) -> io::Result<u64> {
        let id = self.pager.allocate()?;
        self.save(id, node)?;
        Ok(id)
    }
    // Equality goes right: separators are lower bounds of right subtrees.
    fn leaf(&mut self, key: i64) -> io::Result<(u64, Vec<(u64, usize)>)> {
        let mut path = Vec::new();
        let mut id = self.root;
        for _ in 0..self.pager.len() {
            match self.load(id)? {
                Node::Leaf { .. } => return Ok((id, path)),
                Node::Branch { keys, children } => {
                    let i = keys.partition_point(|&separator| separator <= key);
                    path.push((id, i));
                    id = children[i];
                }
            }
        }
        Err(bad("cycle in tree"))
    }
    fn get(&mut self, key: i64) -> io::Result<Option<i64>> {
        let (id, _) = self.leaf(key)?;
        let Node::Leaf { rows, .. } = self.load(id)? else {
            unreachable!()
        };
        Ok(rows
            .binary_search_by_key(&key, |r| r.0)
            .ok()
            .map(|i| rows[i].1))
    }
    fn set(&mut self, key: i64, value: i64) -> io::Result<()> {
        let (id, mut path) = self.leaf(key)?;
        let Node::Leaf { mut rows, next } = self.load(id)? else {
            unreachable!()
        };
        match rows.binary_search_by_key(&key, |r| r.0) {
            Ok(i) => rows[i].1 = value,
            Err(i) => rows.insert(i, (key, value)),
        }
        if rows.len() <= self.max {
            return self.save(id, &Node::Leaf { rows, next });
        }
        let right_rows = rows.split_off(rows.len() / 2);
        let mut separator = right_rows[0].0;
        let mut right = self.new_node(&Node::Leaf {
            rows: right_rows,
            next,
        })?;
        self.save(id, &Node::Leaf { rows, next: right })?;
        while let Some((parent, i)) = path.pop() {
            let Node::Branch {
                mut keys,
                mut children,
            } = self.load(parent)?
            else {
                return Err(bad("bad insertion path"));
            };
            keys.insert(i, separator);
            children.insert(i + 1, right);
            if keys.len() <= self.max {
                return self.save(parent, &Node::Branch { keys, children });
            }
            let mid = keys.len() / 2;
            let right_keys = keys.split_off(mid + 1);
            separator = keys.pop().unwrap();
            let right_children = children.split_off(mid + 1);
            right = self.new_node(&Node::Branch {
                keys: right_keys,
                children: right_children,
            })?;
            self.save(parent, &Node::Branch { keys, children })?;
        }
        self.root = self.new_node(&Node::Branch {
            keys: vec![separator],
            children: vec![self.root, right],
        })?;
        self.save_meta()
    }
    fn range(&mut self, lo: i64, hi: i64) -> io::Result<Vec<(i64, i64)>> {
        if lo > hi {
            return Ok(vec![]);
        }
        let (mut id, _) = self.leaf(lo)?;
        let mut result = Vec::new();
        let mut seen = std::collections::HashSet::new();
        loop {
            if !seen.insert(id) {
                return Err(bad("cycle in leaf chain"));
            }
            let Node::Leaf { rows, next } = self.load(id)? else {
                return Err(bad("next points to branch"));
            };
            for (k, v) in rows {
                if k > hi {
                    return Ok(result);
                }
                if k >= lo {
                    result.push((k, v));
                }
            }
            if next == 0 {
                return Ok(result);
            }
            id = next;
        }
    }
    fn flush(&mut self) -> io::Result<()> {
        self.pager.flush()
    }
}
fn main() -> io::Result<()> {
    let args: Vec<_> = std::env::args().collect();
    let path = args
        .get(1)
        .ok_or_else(|| bad("usage: btree FILE [MAX_KEYS]"))?;
    let max = args
        .get(2)
        .map(|s| s.parse::<usize>())
        .transpose()
        .map_err(|_| bad("bad max_keys"))?
        .unwrap_or(3);
    let mut t = Tree::open(Path::new(path), max, 3)?;
    for line in io::stdin().lock().lines() {
        let line = line?;
        let words: Vec<_> = line.split_whitespace().collect();
        let integer = |s: &str| s.parse::<i64>().map_err(|_| bad("expected i64"));
        match words.as_slice() {
            ["set", k, v] => {
                t.set(integer(k)?, integer(v)?)?;
                println!("OK");
            }
            ["get", k] => match t.get(integer(k)?)? {
                Some(v) => println!("{v}"),
                None => println!("(nil)"),
            },
            ["range", lo, hi] => {
                let rows = t.range(integer(lo)?, integer(hi)?)?;
                println!(
                    "{}",
                    rows.iter()
                        .map(|(k, v)| format!("{k}:{v}"))
                        .collect::<Vec<_>>()
                        .join(" ")
                );
            }
            [".flush"] => {
                t.flush()?;
                println!("FLUSHED");
            }
            [".exit"] => break,
            [] => {}
            _ => {
                return Err(bad(
                    "commands: set K V | get K | range LO HI | .flush | .exit",
                ));
            }
        }
    }
    t.flush()
}
#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        collections::BTreeMap,
        sync::atomic::{AtomicU64, Ordering},
    };
    static SEQ: AtomicU64 = AtomicU64::new(0);
    struct Temp(std::path::PathBuf);
    impl Temp {
        fn new() -> Self {
            Self(std::env::temp_dir().join(format!(
                "mydb-ch03-{}-{}.db",
                std::process::id(),
                SEQ.fetch_add(1, Ordering::Relaxed)
            )))
        }
        fn tree(&self, max: usize) -> Tree {
            Tree::open(&self.0, max, 1).unwrap()
        }
    }
    impl Drop for Temp {
        fn drop(&mut self) {
            let _ = std::fs::remove_file(&self.0);
        }
    }
    // Verify balance, separator meaning, occupancy and the complete leaf chain.
    fn verify(t: &mut Tree) {
        fn walk(
            t: &mut Tree,
            id: u64,
            root: bool,
            level: usize,
            depths: &mut Vec<usize>,
            leaves: &mut Vec<u64>,
        ) -> Option<(i64, i64)> {
            match t.load(id).unwrap() {
                Node::Leaf { rows, .. } => {
                    assert!(rows.len() <= t.max);
                    if !root {
                        assert!(rows.len() >= t.max.div_ceil(2));
                    }
                    depths.push(level);
                    leaves.push(id);
                    rows.first().zip(rows.last()).map(|(a, b)| (a.0, b.0))
                }
                Node::Branch { keys, children } => {
                    assert_eq!(children.len(), keys.len() + 1);
                    assert!(!keys.is_empty() && keys.len() <= t.max);
                    if !root {
                        assert!(keys.len() >= t.max / 2);
                    }
                    let ranges: Vec<_> = children
                        .into_iter()
                        .map(|c| walk(t, c, false, level + 1, depths, leaves).unwrap())
                        .collect();
                    for i in 0..keys.len() {
                        assert!(ranges[i].1 < keys[i]);
                        assert_eq!(keys[i], ranges[i + 1].0);
                    }
                    Some((ranges[0].0, ranges.last().unwrap().1))
                }
            }
        }
        let mut depths = vec![];
        let mut leaves = vec![];
        walk(t, t.root, true, 0, &mut depths, &mut leaves);
        assert!(depths.iter().all(|d| *d == depths[0]));
        for (i, &id) in leaves.iter().enumerate() {
            let Node::Leaf { next, .. } = t.load(id).unwrap() else {
                unreachable!()
            };
            assert_eq!(next, leaves.get(i + 1).copied().unwrap_or(0));
        }
    }
    #[test]
    fn empty_and_missing() {
        let f = Temp::new();
        let mut t = f.tree(3);
        assert_eq!(t.get(7).unwrap(), None);
        assert!(t.range(-9, 9).unwrap().is_empty());
        verify(&mut t);
    }
    #[test]
    fn duplicate_updates_without_allocating() {
        let f = Temp::new();
        let mut t = f.tree(3);
        t.set(10, 1).unwrap();
        let n = t.pager.len();
        t.set(10, 2).unwrap();
        assert_eq!(t.pager.len(), n);
        assert_eq!(t.get(10).unwrap(), Some(2));
    }
    #[test]
    fn leaf_split_copies_separator() {
        let f = Temp::new();
        let mut t = f.tree(3);
        for k in [10, 20, 30, 40] {
            t.set(k, k * 10).unwrap();
        }
        let Node::Branch { keys, .. } = t.load(t.root).unwrap() else {
            panic!()
        };
        assert_eq!(keys, vec![30]);
        assert_eq!(t.get(30).unwrap(), Some(300));
        verify(&mut t);
    }
    #[test]
    fn ascending_cascades_and_reopen() {
        let f = Temp::new();
        let mut t = f.tree(3);
        for k in 0..180 {
            t.set(k, -k).unwrap();
        }
        verify(&mut t);
        let root = t.root;
        t.flush().unwrap();
        drop(t);
        let mut t = f.tree(3);
        assert_eq!(t.root, root);
        for k in 0..180 {
            assert_eq!(t.get(k).unwrap(), Some(-k));
        }
        // Continue growing a tree loaded from disk, including further splits.
        for k in 180..260 {
            t.set(k, -k).unwrap();
        }
        assert_eq!(t.get(259).unwrap(), Some(-259));
        assert_eq!(t.range(175, 185).unwrap().len(), 11);
        verify(&mut t);
    }
    #[test]
    fn descending_and_even_capacity() {
        let f = Temp::new();
        let mut t = f.tree(4);
        for k in (0..100).rev() {
            t.set(k, k + 1).unwrap();
        }
        verify(&mut t);
        assert_eq!(
            t.range(20, 25).unwrap(),
            (20..=25).map(|k| (k, k + 1)).collect::<Vec<_>>()
        );
    }
    #[test]
    fn range_boundaries_and_gaps() {
        let f = Temp::new();
        let mut t = f.tree(3);
        for k in [10, 20, 30, 40, 50, 60, 70] {
            t.set(k, k).unwrap();
        }
        assert_eq!(
            t.range(21, 60).unwrap(),
            vec![(30, 30), (40, 40), (50, 50), (60, 60)]
        );
        assert!(t.range(22, 29).unwrap().is_empty());
        assert!(t.range(60, 20).unwrap().is_empty());
        assert_eq!(t.range(30, 30).unwrap(), vec![(30, 30)]);
    }
    #[test]
    fn signed_extremes() {
        let f = Temp::new();
        let mut t = f.tree(3);
        for k in [i64::MIN, -1, 0, 1, i64::MAX] {
            t.set(k, k).unwrap();
        }
        assert_eq!(t.range(i64::MIN, i64::MAX).unwrap().len(), 5);
        assert_eq!(t.get(i64::MAX).unwrap(), Some(i64::MAX));
        verify(&mut t);
    }
    #[test]
    fn deterministic_mixed_updates_match_btreemap() {
        let f = Temp::new();
        let mut t = f.tree(5);
        let mut model = BTreeMap::new();
        let mut seed = 17u64;
        for v in 0..700 {
            seed = seed.wrapping_mul(6364136223846793005).wrapping_add(1);
            let k = ((seed >> 32) % 401) as i64 - 200;
            t.set(k, v).unwrap();
            model.insert(k, v);
        }
        assert_eq!(
            t.range(i64::MIN, i64::MAX).unwrap(),
            model.iter().map(|(&k, &v)| (k, v)).collect::<Vec<_>>()
        );
        for k in -210..210 {
            assert_eq!(t.get(k).unwrap(), model.get(&k).copied());
        }
        verify(&mut t);
    }
    #[test]
    fn upper_capacity() {
        let f = Temp::new();
        let mut t = f.tree(200);
        for k in 0..420 {
            t.set(k, k).unwrap();
        }
        verify(&mut t);
        assert_eq!(t.range(0, 500).unwrap().len(), 420);
    }
    #[test]
    fn codec_and_byte_order() {
        let n = Node::Leaf {
            rows: vec![(10, 100)],
            next: 0,
        };
        let b = n.encode();
        assert_eq!(&b[..11], &[1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
        assert_eq!(&b[11..19], &10i64.to_le_bytes());
        assert_eq!(Node::decode(&b, 3, 2).unwrap(), n);
        let b = Node::Branch {
            keys: vec![30],
            children: vec![1, 2],
        };
        assert_eq!(Node::decode(&b.encode(), 3, 4).unwrap(), b);
        assert!(Node::decode(&[1, 1], 3, 4).is_err());
        assert!(Node::decode(&[9; 11], 3, 4).is_err());
        assert!(
            Node::decode(
                &Node::Leaf {
                    rows: vec![(2, 0), (1, 0)],
                    next: 0
                }
                .encode(),
                3,
                4
            )
            .is_err()
        );
    }
    #[test]
    fn cycles_and_bad_metadata_are_errors() {
        let f = Temp::new();
        let mut t = f.tree(3);
        let root = t.root;
        t.save(
            root,
            &Node::Branch {
                keys: vec![0],
                children: vec![root, root],
            },
        )
        .unwrap();
        assert!(t.get(1).is_err());
        t.save(
            root,
            &Node::Leaf {
                rows: vec![(1, 1)],
                next: root,
            },
        )
        .unwrap();
        assert!(t.range(0, 10).is_err());
        t.pager.write(0, b"wrong metadata").unwrap();
        t.flush().unwrap();
        drop(t);
        assert!(Tree::open(&f.0, 3, 1).is_err());
    }
    #[test]
    fn mismatched_order_and_legacy_file_rejected() {
        let f = Temp::new();
        let t = f.tree(3);
        drop(t);
        assert!(Tree::open(&f.0, 4, 1).is_err());
        assert!(Tree::open(&f.0, 2, 1).is_err());
        let f = Temp::new();
        let mut p = storage::Pager::open(&f.0, 1).unwrap();
        p.allocate().unwrap();
        assert!(p.read(0).is_err()); // A failed read must still release its pin.
        p.write(0, b"abc").unwrap();
        p.flush().unwrap();
        drop(p);
        assert!(Tree::open(&f.0, 3, 1).is_err());
    }
}
