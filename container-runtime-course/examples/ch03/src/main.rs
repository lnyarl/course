use std::ffi::CString;
use std::fs::{self, File};
use std::os::unix::fs::symlink;
use std::path::{Path, PathBuf};

use anyhow::{Context, Result, bail};
use clap::{Parser, Subcommand};
use nix::errno::Errno;
use nix::libc;
use nix::mount::{MntFlags, MsFlags, mount, umount2};
use nix::sched::{CloneFlags, clone};
use nix::sys::signal::{SigHandler, Signal, signal};
use nix::sys::wait::{WaitStatus, waitpid};
use nix::unistd::{ForkResult, Pid, chdir, execvp, fork, pivot_root, sethostname};

const STACK_SIZE: usize = 1024 * 1024;
const OLD_ROOT: &str = ".oldroot";
/// 호스트에서 빌려 올 장치 파일
const DEVICES: [&str; 6] = ["null", "zero", "full", "random", "urandom", "tty"];

#[derive(Parser)]
#[command(name = "myctr", about = "나만의 컨테이너 런타임")]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    /// 명령을 새 네임스페이스와 rootfs 안에서 실행한다
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
        /// 실행할 프로그램과 인자
        #[arg(required = true, trailing_var_arg = true, allow_hyphen_values = true)]
        cmd: Vec<String>,
    },
}

/// clone된 자식에게 넘길 설정
struct Config {
    rootfs: PathBuf,
    hostname: String,
    init: bool,
    argv: Vec<CString>,
}

fn main() -> Result<()> {
    match Cli::parse().command {
        Command::Run { rootfs, hostname, init, cmd } => {
            let argv = cmd
                .iter()
                .map(|s| CString::new(s.as_bytes()))
                .collect::<Result<_, _>>()
                .context("인자에 NUL 바이트가 있습니다")?;
            // 자식은 cwd가 바뀌기 전에 경로를 해석해야 하므로 절대 경로로 만든다
            let rootfs = fs::canonicalize(&rootfs)
                .with_context(|| format!("rootfs를 찾을 수 없습니다: {}", rootfs.display()))?;
            let code = run(&Config { rootfs, hostname, init, argv })?;
            std::process::exit(code);
        }
    }
}

fn run(cfg: &Config) -> Result<i32> {
    let mut stack = vec![0u8; STACK_SIZE];
    let flags = CloneFlags::CLONE_NEWUTS | CloneFlags::CLONE_NEWPID | CloneFlags::CLONE_NEWNS;
    let cb = Box::new(|| container_main(cfg));
    let child = unsafe { clone(cb, &mut stack, flags, Some(Signal::SIGCHLD as i32)) }
        .context("clone 실패 (root 권한으로 실행했나요?)")?;

    unsafe { signal(Signal::SIGINT, SigHandler::SigIgn) }.context("signal 설정 실패")?;
    wait_exit_code(child)
}

fn wait_exit_code(child: Pid) -> Result<i32> {
    match waitpid(child, None).context("waitpid 실패")? {
        WaitStatus::Exited(_, code) => Ok(code),
        WaitStatus::Signaled(_, sig, _) => Ok(128 + sig as i32),
        other => bail!("예상하지 못한 상태: {other:?}"),
    }
}

/// clone된 자식. 새 네임스페이스 안의 PID 1이다.
fn container_main(cfg: &Config) -> isize {
    if let Err(e) = setup(cfg) {
        eprintln!("myctr: {e:#}");
        return 1;
    }
    if cfg.init { mini_init(&cfg.argv) } else { exec(&cfg.argv) }
}

/// fork와 exec 사이에서 컨테이너의 모양을 만든다
fn setup(cfg: &Config) -> Result<()> {
    sethostname(&cfg.hostname).context("sethostname")?;
    setup_rootfs(&cfg.rootfs)
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
