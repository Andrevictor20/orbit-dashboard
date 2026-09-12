use once_cell::sync::Lazy;
use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use std::time::{Duration, Instant};

#[derive(Clone, Copy, Debug)]
pub struct CachedContainerSize {
    pub size_rw: Option<i64>,
    pub size_root_fs: Option<i64>,
}

pub(crate) static CONTAINER_SIZE_CACHE: Lazy<RwLock<HashMap<String, CachedContainerSize>>> =
    Lazy::new(|| RwLock::new(HashMap::new()));
pub(crate) static LAST_SIZE_SCAN: Lazy<RwLock<Option<Instant>>> =
    Lazy::new(|| RwLock::new(None));

pub fn get_cached_container_sizes() -> HashMap<String, CachedContainerSize> {
    CONTAINER_SIZE_CACHE.read().map(|c| c.clone()).unwrap_or_default()
}

pub fn trigger_container_size_scan_if_needed(docker: Arc<bollard::Docker>) {
    let should_scan = {
        let last = LAST_SIZE_SCAN.read().unwrap();
        match *last {
            Some(instant) => instant.elapsed() > Duration::from_secs(60),
            None => true,
        }
    };

    if should_scan {
        if let Ok(mut last) = LAST_SIZE_SCAN.write() {
            *last = Some(Instant::now());
        }

        tokio::spawn(async move {
            let mut options = bollard::query_parameters::ListContainersOptions::default();
            options.all = true;
            options.size = true;
            if let Ok(containers) = docker.list_containers(Some(options)).await {
                if let Ok(mut cache) = CONTAINER_SIZE_CACHE.write() {
                    for c in containers {
                        if let Some(id) = c.id {
                            let size = CachedContainerSize {
                                size_rw: c.size_rw,
                                size_root_fs: c.size_root_fs,
                            };
                            cache.insert(id.clone(), size);
                            if id.len() >= 12 {
                                cache.insert(id[..12].to_string(), size);
                            }
                        }
                    }
                }
            }
        });
    }
}
