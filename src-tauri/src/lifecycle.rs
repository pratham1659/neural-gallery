/// Configure process-level anti-forensic defenses:
/// 1. Disable core dumps (`RLIMIT_CORE = 0`)
/// 2. Prevent debugger attachment on macOS via `PT_DENY_ATTACH` (if non-debug build)
pub fn setup_anti_forensics() {
    unsafe {
        // Set core dump limit to 0 bytes
        let rlim = libc::rlimit {
            rlim_cur: 0,
            rlim_max: 0,
        };
        libc::setrlimit(libc::RLIMIT_CORE, &rlim);

        #[cfg(not(debug_assertions))]
        {
            // Deny debugger attachment in release binaries to prevent memory snooping
            libc::ptrace(libc::PT_DENY_ATTACH, 0, std::ptr::null_mut::<libc::c_char>(), 0);
        }
    }
}
