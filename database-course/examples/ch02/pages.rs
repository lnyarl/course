use std::{fs::{File, OpenOptions}, io::{self, Read, Seek, SeekFrom, Write}, path::Path};
const SIZE: usize = 4096;
const HEADER: usize = 8;
const SLOT: usize = 4;
type PageId = u64;
fn invalid(message: &str) -> io::Error { io::Error::new(io::ErrorKind::InvalidData, message) }
fn busy() -> io::Error { io::Error::other("all frames are pinned") }

#[derive(Clone)]
struct Page([u8; SIZE]);
impl Page {
    fn new() -> Self {
        let mut p = Self([0; SIZE]);
        p.0[..4].copy_from_slice(b"PG02");
        p.put16(6, SIZE);
        p
    }
    fn u16(&self, at: usize) -> usize { u16::from_le_bytes([self.0[at], self.0[at+1]]) as usize }
    fn put16(&mut self, at: usize, value: usize) { self.0[at..at+2].copy_from_slice(&(value as u16).to_le_bytes()); }
    fn count(&self) -> usize { self.u16(4) }
    fn lower(&self) -> usize { HEADER + self.count() * SLOT }
    fn free(&self) -> usize { self.u16(6) - self.lower() }
    fn validate(&self) -> io::Result<()> {
        if &self.0[..4] != b"PG02" { return Err(invalid("bad page magic")); }
        let lower = self.lower();
        let upper = self.u16(6);
        if lower > upper || upper > SIZE { return Err(invalid("bad page boundaries")); }
        let mut ranges = Vec::new();
        for slot in 0..self.count() {
            let at = HEADER + slot * SLOT;
            let start = self.u16(at);
            let len = self.u16(at+2);
            if len == 0 || start < upper || start + len > SIZE { return Err(invalid("bad slot")); }
            ranges.push((start, start+len));
        }
        ranges.sort_unstable();
        if ranges.windows(2).any(|w| w[0].1 > w[1].0) { return Err(invalid("overlapping slots")); }
        Ok(())
    }
    fn insert(&mut self, bytes: &[u8]) -> io::Result<u16> {
        if bytes.is_empty() || bytes.len() > self.free().saturating_sub(SLOT) || self.free() < SLOT {
            return Err(io::Error::other("record does not fit"));
        }
        let slot = self.count();
        let end = self.u16(6);
        let start = end - bytes.len();
        self.0[start..end].copy_from_slice(bytes);
        self.put16(HEADER + slot*SLOT, start);
        self.put16(HEADER + slot*SLOT+2, bytes.len());
        self.put16(4, slot+1);
        self.put16(6, start);
        Ok(slot as u16)
    }
    fn get(&self, slot: u16) -> Option<&[u8]> {
        let slot = slot as usize;
        if slot >= self.count() { return None; }
        let at = HEADER + slot*SLOT;
        let start = self.u16(at);
        Some(&self.0[start..start+self.u16(at+2)])
    }
}

struct Disk { file: File, pages: u64 }
impl Disk {
    fn open(path: &Path) -> io::Result<Self> {
        let file = OpenOptions::new().read(true).write(true).create(true).truncate(false).open(path)?;
        let len = file.metadata()?.len();
        if len % SIZE as u64 != 0 { return Err(invalid("partial page file")); }
        Ok(Self { file, pages: len / SIZE as u64 })
    }
    fn offset(&self, id: PageId) -> io::Result<u64> {
        if id >= self.pages { return Err(invalid("page not allocated")); }
        id.checked_mul(SIZE as u64).ok_or_else(|| invalid("offset overflow"))
    }
    fn read(&mut self, id: PageId) -> io::Result<Page> {
        let offset = self.offset(id)?;
        self.file.seek(SeekFrom::Start(offset))?;
        let mut p = Page([0; SIZE]);
        self.file.read_exact(&mut p.0)?;
        p.validate()?;
        Ok(p)
    }
    fn write(&mut self, id: PageId, page: &Page) -> io::Result<()> {
        let offset = self.offset(id)?;
        self.file.seek(SeekFrom::Start(offset))?;
        self.file.write_all(&page.0)
    }
    fn allocate(&mut self) -> io::Result<PageId> {
        let id = self.pages;
        let offset = id.checked_mul(SIZE as u64).ok_or_else(|| invalid("offset overflow"))?;
        self.file.seek(SeekFrom::Start(offset))?;
        self.file.write_all(&Page::new().0)?;
        self.pages += 1;
        Ok(id)
    }
}

struct Frame { id: PageId, page: Page, pins: usize, dirty: bool, referenced: bool }
struct Pool { disk: Disk, frames: Vec<Option<Frame>>, hand: usize, reads: u64, writes: u64 }
impl Pool {
    fn new(disk: Disk, capacity: usize) -> io::Result<Self> {
        if capacity == 0 { return Err(io::Error::other("capacity must be positive")); }
        Ok(Self { disk, frames: (0..capacity).map(|_| None).collect(), hand: 0, reads: 0, writes: 0 })
    }
    fn victim(&mut self) -> io::Result<usize> {
        if let Some(i) = self.frames.iter().position(Option::is_none) { return Ok(i); }
        for _ in 0..self.frames.len()*2 {
            let i = self.hand;
            self.hand = (self.hand+1) % self.frames.len();
            let f = self.frames[i].as_mut().unwrap();
            if f.pins > 0 { continue; }
            if f.referenced { f.referenced = false; continue; }
            return Ok(i);
        }
        Err(busy())
    }
    fn writeback(&mut self, i: usize) -> io::Result<()> {
        if let Some(f) = &mut self.frames[i] {
            if f.dirty {
                self.disk.write(f.id, &f.page)?;
                self.writes += 1;
                f.dirty = false;
            }
        }
        Ok(())
    }
    // Every successful fetch owns one pin. Release it exactly once with unpin.
    fn fetch(&mut self, id: PageId) -> io::Result<usize> {
        if let Some(i) = self.frames.iter().position(|f| f.as_ref().is_some_and(|f| f.id == id)) {
            let f = self.frames[i].as_mut().unwrap();
            f.pins += 1;
            f.referenced = true;
            return Ok(i);
        }
        let i = self.victim()?;
        // Read before replacing: a failed read must not destroy the old frame.
        let page = self.disk.read(id)?;
        self.reads += 1;
        self.writeback(i)?;
        self.frames[i] = Some(Frame { id, page, pins: 1, dirty: false, referenced: true });
        Ok(i)
    }
    fn pinned(&self, i: usize) -> io::Result<&Frame> {
        self.frames.get(i).and_then(Option::as_ref).filter(|f| f.pins > 0)
            .ok_or_else(|| io::Error::other("frame is not pinned"))
    }
    fn insert(&mut self, i: usize, bytes: &[u8]) -> io::Result<u16> {
        self.pinned(i)?;
        let f = self.frames[i].as_mut().unwrap();
        let slot = f.page.insert(bytes)?;
        f.dirty = true;
        Ok(slot)
    }
    fn get(&self, i: usize, slot: u16) -> io::Result<Option<&[u8]>> { Ok(self.pinned(i)?.page.get(slot)) }
    fn unpin(&mut self, i: usize) -> io::Result<()> {
        self.pinned(i)?;
        self.frames[i].as_mut().unwrap().pins -= 1;
        Ok(())
    }
    fn flush(&mut self) -> io::Result<()> {
        if self.frames.iter().flatten().any(|f| f.pins > 0) { return Err(busy()); }
        for i in 0..self.frames.len() { self.writeback(i)?; }
        self.disk.file.sync_all()
    }
}

fn main() -> io::Result<()> {
    let path = std::env::args().nth(1).ok_or_else(|| io::Error::other("usage: pages FILE"))?;
    let mut disk = Disk::open(Path::new(&path))?;
    if disk.pages == 0 { disk.allocate()?; }
    let mut pool = Pool::new(disk, 2)?;
    let f = pool.fetch(0)?;
    if pool.frames[f].as_ref().unwrap().page.count() == 0 { pool.insert(f, b"abc")?; }
    println!("page=0 slot=0 value={}", String::from_utf8_lossy(pool.get(f, 0)?.unwrap()));
    pool.unpin(f)?;
    pool.flush()?;
    println!("reads={} writes={}", pool.reads, pool.writes);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU64, Ordering};
    static SEQ: AtomicU64 = AtomicU64::new(0);
    struct Temp(std::path::PathBuf);
    impl Temp {
        fn new() -> Self {
            Self(std::env::temp_dir().join(format!("mydb-ch02-{}-{}-{}.db", module_path!().replace("::", "-"), std::process::id(), SEQ.fetch_add(1, Ordering::Relaxed))))
        }
        fn pool(&self, capacity: usize, pages: usize) -> Pool {
            let mut d = Disk::open(&self.0).unwrap();
            for _ in 0..pages { d.allocate().unwrap(); }
            Pool::new(d, capacity).unwrap()
        }
    }
    impl Drop for Temp { fn drop(&mut self) { let _ = std::fs::remove_file(&self.0); } }
    #[test] fn byte_layout() {
        let mut p = Page::new();
        assert_eq!(p.insert(b"abc").unwrap(), 0);
        assert_eq!(&p.0[..12], &[0x50,0x47,0x30,0x32,1,0,0xfd,0x0f,0xfd,0x0f,3,0]);
        assert_eq!(&p.0[4093..], b"abc");
        assert_eq!(p.free(), 4081);
        p.validate().unwrap();
    }
    #[test] fn full_page_preserves_existing_record() {
        let mut p = Page::new();
        p.insert(&vec![7;4084]).unwrap();
        let before = p.0;
        assert!(p.insert(b"x").is_err());
        assert_eq!(p.0, before);
        assert_eq!(p.get(0).unwrap().len(), 4084);
        assert!(p.get(1).is_none());
    }
    #[test] fn zero_and_oversize_rejected() {
        let mut p = Page::new();
        assert!(p.insert(b"").is_err());
        assert!(p.insert(&vec![0;4085]).is_err());
        assert_eq!(p.count(), 0);
    }
    #[test] fn slots_stay_stable() {
        let mut p = Page::new();
        for b in [b"one".as_slice(), b"longer", b"z"] { p.insert(b).unwrap(); }
        assert_eq!(p.get(0).unwrap(), b"one");
        assert_eq!(p.get(1).unwrap(), b"longer");
        assert_eq!(p.get(2).unwrap(), b"z");
    }
    #[test] fn corrupt_page_rejected() {
        let mut p = Page::new(); p.insert(b"abc").unwrap();
        p.put16(8, 4095);
        assert!(p.validate().is_err());
        p = Page::new(); p.put16(4, u16::MAX as usize);
        assert!(p.validate().is_err());
        p = Page::new(); p.insert(b"abc").unwrap(); p.insert(b"def").unwrap();
        p.put16(12, 4093);
        assert!(p.validate().is_err());
    }
    #[test] fn repeated_fetch_is_a_hit_and_counts_pins() {
        let t = Temp::new(); let mut p = t.pool(1, 2);
        let a = p.fetch(0).unwrap(); let b = p.fetch(0).unwrap();
        assert_eq!(a,b); assert_eq!(p.reads,1);
        p.unpin(a).unwrap(); assert!(p.fetch(1).is_err());
        p.unpin(b).unwrap(); assert!(p.fetch(1).is_ok());
    }
    #[test] fn all_pinned_fails_without_losing_data() {
        let t = Temp::new(); let mut p = t.pool(1, 2);
        let f = p.fetch(0).unwrap(); p.insert(f,b"kept").unwrap();
        assert!(p.fetch(1).is_err()); assert_eq!(p.get(f,0).unwrap().unwrap(),b"kept");
        assert!(p.flush().is_err());
    }
    #[test] fn dirty_eviction_survives_reopen() {
        let t = Temp::new(); let mut p = t.pool(1,2);
        let f = p.fetch(0).unwrap(); p.insert(f,b"saved").unwrap(); p.unpin(f).unwrap();
        let f = p.fetch(1).unwrap(); p.unpin(f).unwrap();
        assert_eq!(p.writes,1); p.flush().unwrap(); drop(p);
        let mut d = Disk::open(&t.0).unwrap();
        assert_eq!(d.read(0).unwrap().get(0).unwrap(),b"saved");
    }
    #[test] fn clean_eviction_does_not_write() {
        let t = Temp::new(); let mut p = t.pool(1,2);
        for id in [0,1,0] { let f = p.fetch(id).unwrap(); p.unpin(f).unwrap(); }
        assert_eq!(p.reads,3); assert_eq!(p.writes,0);
        p.flush().unwrap(); assert_eq!(p.writes,0);
    }
    #[test] fn clock_skips_pinned_frame() {
        let t = Temp::new(); let mut p = t.pool(2,3);
        let a = p.fetch(0).unwrap(); let b = p.fetch(1).unwrap(); p.unpin(b).unwrap();
        let c = p.fetch(2).unwrap(); assert_eq!(b,c);
        assert_eq!(p.frames[a].as_ref().unwrap().id,0);
        assert_eq!(p.hand,0);
    }
    #[test] fn bad_read_keeps_old_frame() {
        let t = Temp::new(); let mut p = t.pool(1,1);
        let f = p.fetch(0).unwrap(); p.insert(f,b"alive").unwrap(); p.unpin(f).unwrap();
        assert!(p.fetch(99).is_err());
        let f = p.fetch(0).unwrap(); assert_eq!(p.get(f,0).unwrap().unwrap(),b"alive");
        assert_eq!(p.writes,0);
    }
    #[test] fn partial_file_and_unbalanced_unpin_rejected() {
        let t = Temp::new(); let mut p = t.pool(1,1);
        let f = p.fetch(0).unwrap(); p.unpin(f).unwrap();
        assert!(p.unpin(f).is_err()); drop(p);
        std::fs::write(&t.0,b"short").unwrap(); assert!(Disk::open(&t.0).is_err());
    }
}
