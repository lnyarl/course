use std::ffi::CString;
use std::fs::{self, File};
use std::os::unix::fs::symlink;
use std::os::fd::{AsRawFd, RawFd};
use std::path::{Path, PathBuf};

use anyhow::{Context, Result, bail};
use clap::{Parser, Subcommand};
use nix::errno::Errno;
use nix::fcntl::OFlag;
use nix::libc;
use nix::mount::{MntFlags, MsFlags, mount, umount2};
use nix::unistd::{chdir, pivot_root};
use nix::sched::{CloneFlags, clone};
use nix::sys::signal::{SigHandler, Signal, signal};
use nix::sys::wait::{WaitStatus, waitpid};
use nix::unistd::{
    ForkResult, Gid, Pid, Uid, close, execvp, fork, pipe2, read, setgid, setgroups, sethostname, setuid, write,
};

const OLD_ROOT: &str = ".oldroot";
const DEVICES: [&str; 6] = ["null", "zero", "full", "random", "urandom", "tty"];

const STACK_SIZE: usize = 1024 * 1024;
const CGROUP_ROOT: &str = "/sys/fs/cgroup";
/// myctr가 만드는 모든 컨테이너 cgroup의 부모
const CGROUP_PARENT: &str = "myctr";
const CPU_PERIOD_US: u64 = 100_000;
/// --userns-base 로 매핑할 ID 개수
const USERNS_RANGE: u32 = 65536;

#[derive(Parser)]
#[command(name = "myctr", about = "나만의 컨테이너 런타임")]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    /// 명령을 새 네임스페이스와 cgroup 안에서 실행한다
    Run {
        /// 컨테이너의 루트가 될 디렉터리
        #[arg(long)]
        rootfs: PathBuf,
        /// 컨테이너 안에서 보일 hostname
        #[arg(long, default_value = "myctr")]
        hostname: String,
        /// PID 1에 작은 init을 두고 명령은 PID 2로 실행한다
        #[arg(long)]
        init: bool,
        /// 메모리 상한 (예: 64M, 1G, 바이트 수)
        #[arg(long, value_parser = parse_bytes)]
        memory: Option<u64>,
        /// CPU 상한 (코어 수, 예: 0.5)
        #[arg(long)]
        cpus: Option<f64>,
        /// 최대 프로세스(스레드) 수
        #[arg(long)]
        pids: Option<u64>,
        /// (root 전용) 컨테이너의 UID/GID 0..65535 를 이 호스트 ID부터 매핑한다
        #[arg(long)]
        userns_base: Option<u32>,
        /// 실행할 프로그램과 인자
        #[arg(required = true, trailing_var_arg = true, allow_hyphen_values = true)]
        cmd: Vec<String>,
    },
}

struct Limits {
    memory: Option<u64>,
    cpus: Option<f64>,
    pids: Option<u64>,
}

impl Limits {
    fn any(&self) -> bool {
        self.memory.is_some() || self.cpus.is_some() || self.pids.is_some()
    }
}

/// clone된 자식에게 넘길 설정
struct Config {
    rootfs: PathBuf,
    hostname: String,
    init: bool,
    argv: Vec<CString>,
    /// 부모가 준비를 마쳤다고 알려 주는 파이프 (읽는 쪽, 쓰는 쪽)
    sync: (RawFd, RawFd),
    userns: bool,
    clear_groups: bool,
}

fn main() -> Result<()> {
    match Cli::parse().command {
        Command::Run { rootfs, hostname, init, memory, cpus, pids, userns_base, cmd } => {
            let argv = cmd
                .iter()
                .map(|s| CString::new(s.as_bytes()))
                .collect::<Result<_, _>>()
                .context("인자에 NUL 바이트가 있습니다")?;
            let rootfs = fs::canonicalize(&rootfs).context("rootfs 경로 확인")?;
            validate_rootfs(&rootfs)?;
            let code = run(rootfs, hostname, init, argv, &Limits { memory, cpus, pids }, userns_base)?;
            std::process::exit(code);
        }
    }
}

/// "64M", "1G", "512K", "1048576" 을 바이트 수로
fn parse_bytes(s: &str) -> Result<u64, String> {
    let (num, mul) = match s.chars().last() {
        Some('K' | 'k') => (&s[..s.len() - 1], 1 << 10),
        Some('M' | 'm') => (&s[..s.len() - 1], 1 << 20),
        Some('G' | 'g') => (&s[..s.len() - 1], 1 << 30),
        _ => (s, 1),
    };
    num.parse::<u64>().map(|n| n * mul).map_err(|e| format!("{s}: {e}"))
}

fn run(rootfs: PathBuf, 
    hostname: String,
    init: bool,
    argv: Vec<CString>,
    limits: &Limits,
    userns_base: Option<u32>,
) -> Result<i32> {
    let rootless = !Uid::effective().is_root();
    let idmap = match (rootless, userns_base) {
        (true, Some(_)) => bail!("--userns-base는 root로 실행할 때만 쓸 수 있습니다"),
        (true, None) => Some(IdMap::rootless()),
        (false, Some(base)) => {
            if base.checked_add(USERNS_RANGE - 1).is_none_or(|last| last == u32::MAX) {
                bail!("--userns-base는 0..4294901759 범위여야 합니다 (65536개 ID, UID/GID -1 제외)");
            }
            Some(IdMap::range(base))
        },
        (false, None) => None,
    };
    let cgroup = if rootless {
        if limits.any() {
            bail!("rootless 모드에서는 --memory/--cpus/--pids를 쓸 수 없습니다 (cgroup 위임이 필요합니다)");
        }
        None
    } else {
        Some(Cgroup::create(&format!("ctr-{}", std::process::id()), limits)?)
    };

    // O_CLOEXEC: 사용자 프로그램으로 새지 않게
    let (sync_rd, sync_wr) = pipe2(OFlag::O_CLOEXEC).context("pipe")?;
    let cfg = Config { rootfs,
        hostname, init, argv,
        sync: (sync_rd.as_raw_fd(), sync_wr.as_raw_fd()),
        userns: idmap.is_some(),
        // 특권 range 모드에서는 상속한 호스트 보조 그룹을 남기지 않는다.
        // rootless는 setgroups=deny이므로 변경할 수 없다.
        clear_groups: idmap.as_ref().is_some_and(|map| !map.deny_setgroups),
    };

    let mut flags = CloneFlags::CLONE_NEWUTS | CloneFlags::CLONE_NEWPID | CloneFlags::CLONE_NEWNS;
    if idmap.is_some() {
        flags |= CloneFlags::CLONE_NEWUSER;
    }
    let mut stack = vec![0u8; STACK_SIZE];
    let cb = Box::new(|| container_main(&cfg));
    let child = unsafe { clone(cb, &mut stack, flags, Some(Signal::SIGCHLD as i32)) }
        .context("clone 실패")?;
    drop(sync_rd);

    // 준비 실패 시 먼저 파이프를 닫는다. 자식은 EOF를 받고 종료하며,
    // 부모는 반드시 wait로 회수한 뒤 cgroup을 정리한다.
    let prepared = (|| -> Result<()> {
        if let Some(cg) = &cgroup {
            cg.add(child)?;
        }
        if let Some(map) = &idmap {
            map.write(child)?;
        }
        unsafe { signal(Signal::SIGINT, SigHandler::SigIgn) }
            .context("signal 설정 실패")?;
        write(&sync_wr, &[1]).context("자식 깨우기")?;
        Ok(())
    })();
    drop(sync_wr);
    if let Err(error) = prepared {
        // EOF로 종료한 PID 1을 회수하기 전에 Cgroup::drop이 실행되면
        // cgroup.procs가 비어 있지 않아 정리가 실패할 수 있다.
        wait_exit_code(child).context("준비 실패한 자식 회수")?;
        return Err(error);
    }
    let code = wait_exit_code(child)?;
    if cgroup.as_ref().is_some_and(|cg| cg.oom_kills() > 0) {
        eprintln!("myctr: 메모리 상한을 넘어 OOM killer가 프로세스를 종료했습니다");
    }
    Ok(code)
}

fn wait_exit_code(child: Pid) -> Result<i32> {
    loop {
        match waitpid(child, None) {
            Ok(WaitStatus::Exited(_, code)) => return Ok(code),
            Ok(WaitStatus::Signaled(_, sig, _)) => return Ok(128 + sig as i32),
            Ok(other) => bail!("예상하지 못한 상태: {other:?}"),
            Err(Errno::EINTR) => continue,
            Err(error) => return Err(error).context("waitpid 실패"),
        }
    }
}

/// user 네임스페이스의 UID/GID 매핑
struct IdMap {
    uid_map: String,
    gid_map: String,
    /// 비특권 프로세스가 gid_map을 쓰려면 먼저 setgroups를 막아야 한다
    deny_setgroups: bool,
}

impl IdMap {
    /// 컨테이너 root(0) 하나를 나 자신에게
    fn rootless() -> Self {
        IdMap {
            uid_map: format!("0 {} 1", Uid::effective()),
            gid_map: format!("0 {} 1", Gid::effective()),
            deny_setgroups: true,
        }
    }

    /// 컨테이너의 0..65535 를 호스트의 base..base+65535 로
    fn range(base: u32) -> Self {
        IdMap {
            uid_map: format!("0 {base} {USERNS_RANGE}"),
            gid_map: format!("0 {base} {USERNS_RANGE}"),
            deny_setgroups: false,
        }
    }

    fn write(&self, pid: Pid) -> Result<()> {
        let proc = PathBuf::from(format!("/proc/{pid}"));
        if self.deny_setgroups {
            fs::write(proc.join("setgroups"), "deny").context("setgroups 막기")?;
        }
        fs::write(proc.join("uid_map"), &self.uid_map)
            .with_context(|| format!("uid_map 쓰기 ({})", self.uid_map))?;
        fs::write(proc.join("gid_map"), &self.gid_map)
            .with_context(|| format!("gid_map 쓰기 ({})", self.gid_map))?;
        Ok(())
    }
}

struct Cgroup {
    path: PathBuf,
}

impl Cgroup {
    fn create(name: &str, limits: &Limits) -> Result<Self> {
        let parent = Path::new(CGROUP_ROOT).join(CGROUP_PARENT);
        fs::create_dir_all(&parent).with_context(|| format!("{} 만들기", parent.display()))?;
        // 부모에서 컨트롤러를 켜야 자식 cgroup에 memory.max 같은 파일이 생긴다
        fs::write(parent.join("cgroup.subtree_control"), "+memory +cpu +pids")
            .context("컨트롤러 활성화 (상위 cgroup의 cgroup.subtree_control에 memory cpu pids가 켜져 있나요?)")?;

        let path = parent.join(name);
        fs::create_dir(&path).with_context(|| format!("{} 만들기", path.display()))?;
        let cg = Cgroup { path };
        if let Some(bytes) = limits.memory {
            cg.write("memory.max", &bytes.to_string())?;
            // 스왑으로 도망가지 못하게. 스왑 계정이 꺼진 커널에는 파일이 없다
            if cg.path.join("memory.swap.max").exists() {
                cg.write("memory.swap.max", "0")?;
            }
        }
        if let Some(cpus) = limits.cpus {
            let quota = (cpus * CPU_PERIOD_US as f64) as u64;
            cg.write("cpu.max", &format!("{quota} {CPU_PERIOD_US}"))?;
        }
        if let Some(n) = limits.pids {
            cg.write("pids.max", &n.to_string())?;
        }
        Ok(cg)
    }

    fn write(&self, file: &str, value: &str) -> Result<()> {
        fs::write(self.path.join(file), value)
            .with_context(|| format!("{}/{file} 에 {value} 쓰기", self.path.display()))
    }

    /// 프로세스를 이 cgroup으로 옮긴다 (호스트 PID)
    fn add(&self, pid: Pid) -> Result<()> {
        self.write("cgroup.procs", &pid.to_string())
    }

    /// memory.events 의 oom_kill 카운터
    fn oom_kills(&self) -> u64 {
        fs::read_to_string(self.path.join("memory.events"))
            .ok()
            .and_then(|s| {
                s.lines()
                    .find_map(|l| l.strip_prefix("oom_kill ").and_then(|n| n.parse().ok()))
            })
            .unwrap_or(0)
    }
}

impl Drop for Cgroup {
    fn drop(&mut self) {
        // 프로세스가 남아 있으면 EBUSY. PID 1이 끝나면 네임스페이스 전체가 정리되므로 비어 있다
        if let Err(e) = fs::remove_dir(&self.path) {
            eprintln!("myctr: cgroup 정리 실패 {}: {e}", self.path.display());
        }
    }
}

/// clone된 자식. 새 네임스페이스 안의 PID 1이다.
fn container_main(cfg: &Config) -> isize {
    // 부모가 cgroup과 ID 매핑을 끝낼 때까지 기다린다.
    // 쓰는 쪽을 닫아 두어야 부모가 죽었을 때 read가 EOF(0)로 깨어난다
    let _ = close(cfg.sync.1);
    let mut buf = [0u8; 1];
    loop {
        match read(cfg.sync.0, &mut buf) {
            Ok(1) => break,
            Err(Errno::EINTR) => continue,
            _ => {
                eprintln!("myctr: 부모가 준비를 마치지 못했습니다");
                return 1;
            }
        }
    }
    let _ = close(cfg.sync.0);

    if let Err(e) = setup(cfg) {
        eprintln!("myctr: {e:#}");
        return 1;
    }
    if cfg.init { mini_init(&cfg.argv) } else { exec(&cfg.argv) }
}

/// fork와 exec 사이에서 컨테이너의 모양을 만든다
fn setup(cfg: &Config) -> Result<()> {
    if cfg.userns {
        // 매핑은 ID의 대응표만 만든다. 특히 range 모드에서 host UID 0은
        // 매핑 밖이므로, 새 namespace의 ID 0으로 자격 증명을 옮긴다.
        if cfg.clear_groups {
            setgroups(&[]).context("보조 그룹 비우기")?;
        }
        setgid(Gid::from_raw(0)).context("컨테이너 GID 0으로 전환")?;
        setuid(Uid::from_raw(0)).context("컨테이너 UID 0으로 전환")?;
    }
    sethostname(&cfg.hostname).context("sethostname")?;
    setup_rootfs(&cfg.rootfs)?;
    Ok(())
}

/// 실습 중 호스트 /를 rootfs로 지정하거나 준비를 빠뜨리는 실수를 막는다.
/// 신뢰하는 Alpine 입력을 전제로 하며 악성 rootfs 검증기는 아니다.
fn validate_rootfs(rootfs: &Path) -> Result<()> {
    if rootfs == Path::new("/") || !rootfs.is_dir() {
        bail!("rootfs는 호스트 /가 아닌 디렉터리여야 합니다");
    }
    if !fs::symlink_metadata(rootfs.join("bin/sh")).is_ok_and(|meta| meta.is_file() || meta.file_type().is_symlink())
        || !rootfs.join("proc").is_dir() || !rootfs.join("dev").is_dir() {
        bail!("rootfs에 bin/sh와 proc·dev 디렉터리를 준비하세요");
    }
    Ok(())
}

fn setup_rootfs(rootfs: &Path) -> Result<()> {
    // 1. 이후의 마운트가 호스트로 전파되지 않도록 모든 마운트를 private으로
    mount(None::<&str>, "/", None::<&str>, MsFlags::MS_REC | MsFlags::MS_PRIVATE, None::<&str>)
        .context("/ 를 rprivate으로 바꾸기")?;

    // 2. pivot_root의 new_root는 마운트 지점이어야 하므로 자기 자신에게 bind
    mount(Some(rootfs), rootfs, None::<&str>, MsFlags::MS_BIND | MsFlags::MS_REC, None::<&str>)
        .context("rootfs bind mount")?;

    // 3. 루트를 바꾼다. 이전 루트는 /.oldroot 에 걸린다
    let old_root = rootfs.join(OLD_ROOT);
    fs::create_dir_all(&old_root).context(".oldroot 만들기")?;
    pivot_root(rootfs, &old_root).context("pivot_root")?;
    chdir("/").context("chdir /")?;

    // 4. 이 PID 네임스페이스 기준의 procfs
    mount(
        Some("proc"),
        "/proc",
        Some("proc"),
        MsFlags::MS_NOSUID | MsFlags::MS_NODEV | MsFlags::MS_NOEXEC,
        None::<&str>,
    )
    .context("/proc 마운트")?;

    // 5. 최소한의 /dev. 장치 파일은 아직 붙어 있는 이전 루트에서 bind로 빌려 온다
    setup_dev().context("/dev 구성")?;

    // 6. 이전 루트를 떼어 내고 흔적을 지운다
    let old = format!("/{OLD_ROOT}");
    umount2(old.as_str(), MntFlags::MNT_DETACH).context("이전 루트 분리")?;
    fs::remove_dir(&old).context(".oldroot 지우기")?;
    Ok(())
}

fn setup_dev() -> Result<()> {
    mount(
        Some("tmpfs"),
        "/dev",
        Some("tmpfs"),
        MsFlags::MS_NOSUID | MsFlags::MS_STRICTATIME,
        Some("mode=755,size=65536k"),
    )?;
    for dev in DEVICES {
        let target = format!("/dev/{dev}");
        File::create(&target).with_context(|| format!("{target} 만들기"))?;
        let source = format!("/{OLD_ROOT}/dev/{dev}");
        mount(Some(source.as_str()), target.as_str(), None::<&str>, MsFlags::MS_BIND, None::<&str>)
            .with_context(|| format!("{target} bind"))?;
    }
    for (link, to) in [
        ("/dev/fd", "/proc/self/fd"),
        ("/dev/stdin", "/proc/self/fd/0"),
        ("/dev/stdout", "/proc/self/fd/1"),
        ("/dev/stderr", "/proc/self/fd/2"),
    ] {
        symlink(to, link).with_context(|| format!("{link} 링크"))?;
    }
    Ok(())
}

/// 성공하면 돌아오지 않는다. 돌아오면 127.
fn exec(argv: &[CString]) -> isize {
    if let Err(e) = unsafe { signal(Signal::SIGPIPE, SigHandler::SigDfl) } {
        eprintln!("myctr: SIGPIPE 복원 실패: {e}");
        return 1;
    }
    let err = execvp(&argv[0], argv).unwrap_err();
    eprintln!("myctr: {}: {err}", argv[0].to_string_lossy());
    127
}

/// PID 1로 남아 명령을 PID 2로 띄우고, 입양된 고아까지 거두다가
/// 명령이 끝나면 그 종료 코드로 끝난다.
fn mini_init(argv: &[CString]) -> isize {
    let main_child = match unsafe { fork() } {
        Ok(ForkResult::Child) => unsafe { libc::_exit(exec(argv) as i32) },
        Ok(ForkResult::Parent { child }) => child,
        Err(e) => {
            eprintln!("myctr-init: fork: {e}");
            return 1;
        }
    };
    loop {
        match waitpid(None, None) {
            Ok(WaitStatus::Exited(pid, code)) if pid == main_child => return code as isize,
            Ok(WaitStatus::Signaled(pid, sig, _)) if pid == main_child => return 128 + sig as isize,
            Ok(_) => continue,
            Err(Errno::EINTR) => continue,
            Err(e) => {
                eprintln!("myctr-init: waitpid: {e}");
                return 1;
            }
        }
    }
}
