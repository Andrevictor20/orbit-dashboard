use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};

// Rate Limiter tracking: IP -> (Failed Attempts, Lock Expiration)
static RATE_LIMITS: OnceLock<Mutex<HashMap<String, (usize, Instant)>>> = OnceLock::new();

pub fn check_rate_limit(ip: &str) -> bool {
    let limits = RATE_LIMITS.get_or_init(|| Mutex::new(HashMap::new()));
    let mut map = limits.lock().unwrap();
    if let Some(&(attempts, lock_until)) = map.get(ip) {
        if Instant::now() < lock_until {
            return false; // locked
        } else if attempts >= 5 {
            // lock expired, reset
            map.remove(ip);
        }
    }
    true
}

pub fn record_failed_attempt(ip: &str) {
    let limits = RATE_LIMITS.get_or_init(|| Mutex::new(HashMap::new()));
    let mut map = limits.lock().unwrap();
    let entry = map.entry(ip.to_string()).or_insert((0, Instant::now()));
    entry.0 += 1;
    if entry.0 >= 5 {
        entry.1 = Instant::now() + Duration::from_secs(300); // Lock for 5 mins
    }
}

pub fn clear_attempts(ip: &str) {
    let limits = RATE_LIMITS.get_or_init(|| Mutex::new(HashMap::new()));
    let mut map = limits.lock().unwrap();
    map.remove(ip);
}
