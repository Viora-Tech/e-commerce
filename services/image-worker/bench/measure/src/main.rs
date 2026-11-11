//! `measure --json <file> [--cpus <n>] -- <command> [args...]`
//!
//! `--cpus n` pins the command and its children to the first n logical CPUs (Windows job
//! affinity), like a container limited to n cores. Runs a command and writes what it cost as JSON:
//! - `wallMs`: elapsed time.
//! - `cpuMs`: user + kernel time of the command and every process it started.
//! - `cores`: `cpuMs / wallMs`, how many cores it kept busy on average.
//! - `peakRssMb`: peak working set (RSS) of the command's own process.
//! - `peakTreeRssMb`: highest sum of working sets over the whole process tree, sampled every
//!   20 ms (what a `cargo build` really holds, rustc included).
//! - `peakCommitMb` (Windows): peak committed memory of the process tree (job object).
//! - `exitCode`.
//!
//! The command's own stdout/stderr pass through untouched.

use std::process::Command;
use std::time::Instant;

struct Usage {
    cpu_ms: f64,
    peak_rss: u64,
    peak_tree_rss: u64,
    peak_commit: u64,
    exit_code: i32,
}

#[cfg(windows)]
mod platform {
    use super::Usage;
    use std::os::windows::io::AsRawHandle;
    use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
    use std::sync::Arc;
    use windows_sys::Win32::Foundation::{CloseHandle, HANDLE};
    use windows_sys::Win32::System::JobObjects::*;
    use windows_sys::Win32::System::ProcessStatus::{GetProcessMemoryInfo, PROCESS_MEMORY_COUNTERS};
    use windows_sys::Win32::System::Threading::{OpenProcess, SetProcessAffinityMask, PROCESS_QUERY_LIMITED_INFORMATION};

    fn memory(handle: HANDLE) -> PROCESS_MEMORY_COUNTERS {
        let mut c: PROCESS_MEMORY_COUNTERS = unsafe { std::mem::zeroed() };
        c.cb = std::mem::size_of::<PROCESS_MEMORY_COUNTERS>() as u32;
        unsafe { GetProcessMemoryInfo(handle, &mut c, c.cb) };
        c
    }

    /// Sum of the working sets of every process in the job right now.
    fn tree_rss(job: HANDLE) -> u64 {
        #[repr(C)]
        struct List {
            assigned: u32,
            listed: u32,
            ids: [usize; 512],
        }
        let mut list: List = unsafe { std::mem::zeroed() };
        let ok = unsafe {
            QueryInformationJobObject(
                job,
                JobObjectBasicProcessIdList,
                &mut list as *mut _ as *mut _,
                std::mem::size_of::<List>() as u32,
                std::ptr::null_mut(),
            )
        };
        if ok == 0 {
            return 0;
        }
        let mut total = 0u64;
        for &pid in &list.ids[..(list.listed as usize).min(512)] {
            let h = unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid as u32) };
            if h.is_null() {
                continue;
            }
            total += memory(h).WorkingSetSize as u64;
            unsafe { CloseHandle(h) };
        }
        total
    }

    pub fn run(cmd: &mut std::process::Command, cpus: Option<u32>) -> std::io::Result<Usage> {
        let job = unsafe { CreateJobObjectW(std::ptr::null(), std::ptr::null()) };
        if let Some(n) = cpus {
            // Pin the whole tree to the first `n` logical CPUs (what `docker --cpuset-cpus` does).
            let mut limit: JOBOBJECT_BASIC_LIMIT_INFORMATION = unsafe { std::mem::zeroed() };
            limit.LimitFlags = JOB_OBJECT_LIMIT_AFFINITY;
            limit.Affinity = if n >= usize::BITS { usize::MAX } else { (1usize << n) - 1 };
            let ok = unsafe {
                SetInformationJobObject(
                    job,
                    JobObjectBasicLimitInformation,
                    &limit as *const _ as *const _,
                    std::mem::size_of_val(&limit) as u32,
                )
            };
            if ok == 0 {
                eprintln!("measure: job affinity not set: {}", std::io::Error::last_os_error());
            }
        }
        let mut child = cmd.spawn()?;
        let process = child.as_raw_handle() as HANDLE;
        if unsafe { AssignProcessToJobObject(job, process) } == 0 {
            eprintln!("measure: could not join the job: {}", std::io::Error::last_os_error());
        }
        if let Some(n) = cpus {
            // Belt and braces: the process mask too, so threads it already started are pinned.
            let mask = if n >= usize::BITS { usize::MAX } else { (1usize << n) - 1 };
            if unsafe { SetProcessAffinityMask(process, mask) } == 0 {
                eprintln!("measure: process affinity not set: {}", std::io::Error::last_os_error());
            }
        }

        let done = Arc::new(AtomicBool::new(false));
        let peak_tree = Arc::new(AtomicU64::new(0));
        let job_addr = job as usize;
        let sampler = {
            let done = done.clone();
            let peak_tree = peak_tree.clone();
            std::thread::spawn(move || {
                while !done.load(Ordering::Relaxed) {
                    let now = tree_rss(job_addr as HANDLE);
                    peak_tree.fetch_max(now, Ordering::Relaxed);
                    std::thread::sleep(std::time::Duration::from_millis(20));
                }
            })
        };

        let status = child.wait()?;
        done.store(true, Ordering::Relaxed);
        sampler.join().ok();

        let mut acct: JOBOBJECT_BASIC_ACCOUNTING_INFORMATION = unsafe { std::mem::zeroed() };
        let mut ext: JOBOBJECT_EXTENDED_LIMIT_INFORMATION = unsafe { std::mem::zeroed() };
        unsafe {
            QueryInformationJobObject(
                job,
                JobObjectBasicAccountingInformation,
                &mut acct as *mut _ as *mut _,
                std::mem::size_of_val(&acct) as u32,
                std::ptr::null_mut(),
            );
            QueryInformationJobObject(
                job,
                JobObjectExtendedLimitInformation,
                &mut ext as *mut _ as *mut _,
                std::mem::size_of_val(&ext) as u32,
                std::ptr::null_mut(),
            );
        }
        let own = memory(process);
        unsafe { CloseHandle(job) };
        let cpu_100ns = (acct.TotalUserTime + acct.TotalKernelTime) as f64;
        let peak_rss = own.PeakWorkingSetSize as u64;
        Ok(Usage {
            cpu_ms: cpu_100ns / 10_000.0,
            peak_rss,
            peak_tree_rss: peak_tree.load(Ordering::Relaxed).max(peak_rss),
            peak_commit: ext.PeakJobMemoryUsed as u64,
            exit_code: status.code().unwrap_or(-1),
        })
    }
}

#[cfg(unix)]
mod platform {
    use super::Usage;

    pub fn run(cmd: &mut std::process::Command, cpus: Option<u32>) -> std::io::Result<Usage> {
        if let Some(n) = cpus {
            // Linux: wrap in taskset instead (`measure --cpus` is Windows-only for now).
            eprintln!("measure: --cpus {n} is ignored on this platform; use taskset");
        }
        let status = cmd.status()?;
        let mut ru: libc::rusage = unsafe { std::mem::zeroed() };
        unsafe { libc::getrusage(libc::RUSAGE_CHILDREN, &mut ru) };
        let tv = |t: libc::timeval| t.tv_sec as f64 * 1000.0 + t.tv_usec as f64 / 1000.0;
        // ru_maxrss is KiB on Linux: the largest single process, not the tree.
        let peak = ru.ru_maxrss as u64 * 1024;
        Ok(Usage {
            cpu_ms: tv(ru.ru_utime) + tv(ru.ru_stime),
            peak_rss: peak,
            peak_tree_rss: peak,
            peak_commit: 0,
            exit_code: status.code().unwrap_or(-1),
        })
    }
}

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let sep = args.iter().position(|a| a == "--");
    let opt = |name: &str| {
        let end = sep.unwrap_or(args.len());
        args[..end].iter().position(|a| a == name).and_then(|i| args.get(i + 1)).cloned()
    };
    let cpus: Option<u32> = opt("--cpus").and_then(|v| v.parse().ok());
    let (json_path, command) = match (opt("--json"), sep) {
        (Some(path), Some(sep)) if sep + 1 < args.len() => (path, &args[sep + 1..]),
        _ => {
            eprintln!("usage: measure --json <file> [--cpus <n>] -- <command> [args...]");
            std::process::exit(2);
        }
    };
    let mut cmd = Command::new(&command[0]);
    cmd.args(&command[1..]);
    let start = Instant::now();
    let usage = match platform::run(&mut cmd, cpus) {
        Ok(u) => u,
        Err(e) => {
            eprintln!("measure: could not run {}: {e}", command[0]);
            std::process::exit(1);
        }
    };
    let wall_ms = start.elapsed().as_secs_f64() * 1000.0;
    let mb = |b: u64| b as f64 / (1024.0 * 1024.0);
    let json = format!(
        "{{\"wallMs\":{:.1},\"cpuMs\":{:.1},\"cores\":{:.2},\"peakRssMb\":{:.1},\"peakTreeRssMb\":{:.1},\"peakCommitMb\":{:.1},\"exitCode\":{}}}",
        wall_ms,
        usage.cpu_ms,
        usage.cpu_ms / wall_ms.max(1.0),
        mb(usage.peak_rss),
        mb(usage.peak_tree_rss),
        mb(usage.peak_commit),
        usage.exit_code
    );
    if let Err(e) = std::fs::write(&json_path, &json) {
        eprintln!("measure: could not write {json_path}: {e}");
    }
    std::process::exit(usage.exit_code);
}
