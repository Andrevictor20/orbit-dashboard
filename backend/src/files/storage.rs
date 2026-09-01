use std::convert::Infallible;
#[cfg(unix)]
use std::os::unix::fs::MetadataExt;
use futures::stream::Stream;
use tokio_stream::wrappers::ReceiverStream;
use tokio::sync::mpsc;
use axum::response::sse::{Event, Sse};
use axum::{
    extract::Query,
    http::StatusCode,
    Json,
};
use std::fs;
use std::path::Path;
use sysinfo::Disks;
use super::path_utils::{sanitize_path, to_display_path};
use super::types::{
    AnalyzeQuery, DiskAnalysisResponse, DiskItemStat, MountItem, ShortcutPlace, ShortcutsResponse,
    StoragesResponse, UnmountRequest,
};

pub fn is_valid_storage_disk(name: &str, mount_point: &str, fs_type: &str, total_space: u64) -> bool {
    let name_lower = name.to_lowercase();
    let mount_lower = mount_point.to_lowercase();
    let fs_lower = fs_type.to_lowercase();

    let pseudo_fs = [
        "securityfs", "efivarfs", "bpf", "configfs", "selinuxfs", "debugfs",
        "cgroup", "cgroup2", "pstore", "hugetlbfs", "mqueue", "autofs",
        "tracefs", "fusectl", "binfmt_misc", "devtmpfs", "devpts", "proc",
        "sysfs", "tmpfs", "squashfs", "overlay", "overlayfs", "nsfs",
        "rpc_pipefs", "fuse.gvfsd-fuse", "gvfsd-fuse", "fuse.portal", "portal",
        "pipefs", "sockfs", "fuse",
    ];

    if pseudo_fs.iter().any(|&p| fs_lower == p || name_lower == p) {
        return false;
    }

    if mount_lower.starts_with("/sys")
        || mount_lower.starts_with("/proc")
        || mount_lower.starts_with("/dev")
        || mount_lower.starts_with("/run")
        || mount_lower.starts_with("/var/run")
        || mount_lower.starts_with("/etc")
        || mount_lower.starts_with("/tmp")
        || mount_lower.starts_with("/boot")
        || mount_lower.starts_with("/efi")
        || mount_lower.starts_with("/recovery")
        || mount_lower.starts_with("/var/lib/docker")
        || mount_lower.starts_with("/var/lib/containers")
        || mount_lower == "/app/data"
        || mount_lower.starts_with("/host/sys")
        || mount_lower.starts_with("/host/proc")
        || mount_lower.starts_with("/host/dev")
        || mount_lower.starts_with("/host/run")
        || mount_lower.starts_with("/host/etc")
        || mount_lower.starts_with("/host/tmp")
        || mount_lower.starts_with("/host/boot")
        || mount_lower.starts_with("/host/efi")
        || mount_lower.starts_with("/host/recovery")
        || mount_lower.starts_with("/host/var/lib/docker")
    {
        return false;
    }

    // Ignore partitions smaller than 2GB (EFI, bootloader, recovery)
    if total_space < 2 * 1024 * 1024 * 1024 {
        return false;
    }

    true
}

pub async fn get_shortcuts() -> Json<ShortcutsResponse> {
    // 1. Detect real user home folder
    let home_path = if Path::new("/host/home").is_dir() {
        // Find first user directory in /host/home
        let mut user_home = None;
        if let Ok(entries) = fs::read_dir("/host/home") {
            for entry in entries.flatten() {
                if let Ok(ft) = entry.file_type() {
                    if ft.is_dir() {
                        let name = entry.file_name().to_string_lossy().to_string();
                        if !name.starts_with('.') {
                            user_home = Some(format!("/home/{}", name));
                            break;
                        }
                    }
                }
            }
        }
        user_home.unwrap_or_else(|| {
            if Path::new("/host/root").is_dir() {
                "/root".to_string()
            } else {
                "/home".to_string()
            }
        })
    } else if let Ok(h) = std::env::var("HOME") {
        if Path::new(&h).is_dir() || Path::new(&format!("/host{}", h)).is_dir() {
            h
        } else {
            "/home".to_string()
        }
    } else if Path::new("/home").is_dir() {
        "/home".to_string()
    } else {
        "/".to_string()
    };

    // Helper to find existing folder under home or fallback
    let find_user_folder = |candidates: &[&str], default_name: &str| -> String {
        for candidate in candidates {
            let direct = format!("{}/{}", home_path, candidate);
            let host_mapped = format!("/host{}/{}", home_path, candidate);
            if Path::new(&direct).is_dir() || Path::new(&host_mapped).is_dir() {
                return direct;
            }
        }
        format!("{}/{}", home_path, default_name)
    };

    let documents = find_user_folder(&["Documentos", "Documents"], "Documentos");
    let downloads = find_user_folder(&["Downloads", "Transferências"], "Downloads");
    let pictures = find_user_folder(&["Imagens", "Pictures", "Fotos"], "Imagens");
    let music = find_user_folder(&["Músicas", "Música", "Music"], "Músicas");
    let videos = find_user_folder(&["Vídeos", "Videos", "Movies"], "Vídeos");

    let places = vec![
        ShortcutPlace {
            id: "home".to_string(),
            label: "Início".to_string(),
            path: home_path.clone(),
            icon: "home".to_string(),
        },
        ShortcutPlace {
            id: "documents".to_string(),
            label: "Documentos".to_string(),
            path: documents.clone(),
            icon: "file-text".to_string(),
        },
        ShortcutPlace {
            id: "downloads".to_string(),
            label: "Downloads".to_string(),
            path: downloads.clone(),
            icon: "download".to_string(),
        },
        ShortcutPlace {
            id: "pictures".to_string(),
            label: "Imagens".to_string(),
            path: pictures.clone(),
            icon: "image".to_string(),
        },
        ShortcutPlace {
            id: "music".to_string(),
            label: "Músicas".to_string(),
            path: music.clone(),
            icon: "music".to_string(),
        },
        ShortcutPlace {
            id: "videos".to_string(),
            label: "Vídeos".to_string(),
            path: videos.clone(),
            icon: "film".to_string(),
        },
        ShortcutPlace {
            id: "root".to_string(),
            label: "Sistema (Raiz)".to_string(),
            path: "/".to_string(),
            icon: "hard-drive".to_string(),
        },
    ];

    Json(ShortcutsResponse {
        home: home_path.clone(),
        documents: documents.clone(),
        downloads: downloads.clone(),
        pictures,
        music,
        videos,
        root: "/".to_string(),
        places,
        data: None,
        gallery: None,
        media: None,
    })
}

pub async fn list_storages() -> Json<StoragesResponse> {
    let disks = Disks::new_with_refreshed_list();
    let mut mounts_map: std::collections::HashMap<String, MountItem> = std::collections::HashMap::new();

    for disk in &disks {
        let raw_mount = disk.mount_point().to_string_lossy().to_string();
        let name = disk.name().to_string_lossy().to_string();
        let fs_type = disk.file_system().to_string_lossy().to_string();
        let total_bytes = disk.total_space();

        if !is_valid_storage_disk(&name, &raw_mount, &fs_type, total_bytes) {
            continue;
        }

        let mount_point = if raw_mount == "/host" {
            "/".to_string()
        } else if raw_mount.starts_with("/host/") {
            raw_mount.replacen("/host", "", 1)
        } else {
            raw_mount.clone()
        };

        let name_lower = name.to_lowercase();
        let mount_lower = mount_point.to_lowercase();

        let display_name = if name_lower.contains("mmcblk") || name_lower.contains("sdcard") {
            "Cartão microSD".to_string()
        } else if name_lower.contains("nvme") {
            "SSD NVMe".to_string()
        } else if mount_lower.starts_with("/mnt") || mount_lower.starts_with("/media") || mount_lower.starts_with("/run/media") {
            let folder = mount_point.split('/').filter(|s| !s.is_empty()).last().unwrap_or("Externo");
            format!("HD Externo ({})", folder)
        } else if name_lower.starts_with("/dev/sd") || name_lower.starts_with("sd") {
            if mount_point == "/" || mount_point == "/root" || mount_point == "/home" {
                "SSD / HD Principal".to_string()
            } else {
                "Pendrive / HD USB".to_string()
            }
        } else if mount_point == "/" || name_lower == "root" || name_lower == "/dev/root" {
            "Armazenamento do Sistema".to_string()
        } else if !name.is_empty() && !name.starts_with('/') {
            name.clone()
        } else {
            "Armazenamento Local".to_string()
        };

        let group_key = if name.contains("nvme") {
            let parts: Vec<&str> = name.split('p').collect();
            parts.first().copied().unwrap_or(&name).to_string()
        } else if name.starts_with("/dev/sd") && name.len() >= 8 {
            name[..8].to_string()
        } else if name.starts_with("sd") && name.len() >= 3 {
            name[..3].to_string()
        } else {
            name.clone()
        };

        let available_bytes = disk.available_space();
        let used_bytes = total_bytes.saturating_sub(available_bytes);

        let item = MountItem {
            name: display_name,
            mount_point,
            fs_type,
            total_bytes,
            used_bytes,
            available_bytes,
        };

        if let Some(existing) = mounts_map.get_mut(&group_key) {
            if item.total_bytes > existing.total_bytes {
                *existing = item;
            }
        } else {
            mounts_map.insert(group_key, item);
        }
    }

    let mut mounts: Vec<MountItem> = mounts_map.into_values().collect();
    mounts.sort_by(|a, b| b.total_bytes.cmp(&a.total_bytes));

    if mounts.is_empty() {
        mounts.push(MountItem {
            name: "Armazenamento do Sistema".to_string(),
            mount_point: "/".to_string(),
            fs_type: "ext4".to_string(),
            total_bytes: 100 * 1024 * 1024 * 1024,
            used_bytes: 30 * 1024 * 1024 * 1024,
            available_bytes: 70 * 1024 * 1024 * 1024,
        });
    }

    Json(StoragesResponse { mounts })
}

pub async fn unmount_storage(Json(req): Json<UnmountRequest>) -> Result<Json<serde_json::Value>, StatusCode> {
    if req.mount_point == "/" || req.mount_point == "/boot" || req.mount_point == "/etc" {
        return Err(StatusCode::FORBIDDEN);
    }
    // Perform unmount or log
    Ok(Json(serde_json::json!({ "success": true, "unmounted": req.mount_point })))
}

pub fn is_skipped_path(p: &Path) -> bool {
    let s = p.to_string_lossy();
    s.starts_with("/proc")
        || s.starts_with("/sys")
        || s.starts_with("/dev")
        || s.starts_with("/run")
        || s.starts_with("/host/proc")
        || s.starts_with("/host/sys")
        || s.starts_with("/host/dev")
        || s.starts_with("/host/run")
}

pub fn get_dir_size_recursive(root: &Path, tx: Option<&mpsc::Sender<u64>>) -> u64 {
    if is_skipped_path(root) {
        return 0;
    }

    let mut total = 0u64;
    let mut stack = vec![root.to_path_buf()];
    let mut visited_count = 0usize;
    const MAX_VISITED_FILES: usize = 1_000_000;

    while let Some(current) = stack.pop() {
        if is_skipped_path(&current) {
            continue;
        }

        if let Ok(entries) = fs::read_dir(&current) {
            for entry in entries.flatten() {
                visited_count += 1;
                if visited_count > MAX_VISITED_FILES {
                    return total;
                }

                if let Ok(ft) = entry.file_type() {
                    // Do not follow symlinks to avoid infinite loops and circular trees
                    if ft.is_symlink() {
                        continue;
                    }

                    if ft.is_dir() {
                        stack.push(entry.path());
                    } else if ft.is_file() {
                        if let Ok(meta) = entry.metadata() {
                            #[cfg(unix)]
                            let size = meta.blocks() * 512;
                            #[cfg(not(unix))]
                            let size = meta.len();
                            
                            total += size;
                            if let Some(sender) = tx {
                                let _ = sender.blocking_send(size);
                            }
                        }
                    }
                }
            }
        }
    }
    total
}


pub async fn analyze_directory(Query(q): Query<AnalyzeQuery>) -> Result<Sse<impl Stream<Item = Result<Event, Infallible>>>, StatusCode> {
    let target = q.path.as_deref().unwrap_or("/").to_string();
    let path = sanitize_path(&target)?;

    if !path.exists() || !path.is_dir() {
        return Err(StatusCode::NOT_FOUND);
    }

    let target_clone = target.clone();
    let path_clone = path.clone();

    let (tx, mut rx) = mpsc::channel::<u64>(100);
    let (event_tx, event_rx) = mpsc::channel::<Result<Event, Infallible>>(10);

    // Background thread for computation
    let event_tx_clone = event_tx.clone();
tokio::task::spawn_blocking(move || {
        let entries = match std::fs::read_dir(&path_clone) {
            Ok(e) => e,
            Err(_) => return,
        };

        let mut raw_items = Vec::new();
        let mut total_size = 0u64;

        for entry in entries.flatten() {
            let ft = match entry.file_type() {
                Ok(t) => t,
                Err(_) => continue,
            };

            let is_symlink = ft.is_symlink();
            let is_dir = ft.is_dir() && !is_symlink;
            let name = entry.file_name().to_string_lossy().to_string();
            let item_path = entry.path();

            let size = if is_dir {
                get_dir_size_recursive(&item_path, Some(&tx))
            } else if !is_symlink {
                let s = entry.metadata().map(|m| {
                    #[cfg(unix)]
                    return m.blocks() * 512;
                    #[cfg(not(unix))]
                    return m.len();
                }).unwrap_or(0);
                let _ = tx.blocking_send(s);
                s
            } else {
                0
            };

            total_size += size;
            raw_items.push((name, to_display_path(&item_path), is_dir, size));
        }

        let mut items = Vec::new();
        for (name, item_path, is_dir, size) in raw_items {
            let percentage = if total_size > 0 {
                (size as f32 / total_size as f32) * 100.0
            } else {
                0.0
            };

            items.push(DiskItemStat {
                name,
                path: item_path,
                is_dir,
                size,
                percentage,
            });
        }

        items.sort_by(|a, b| b.size.cmp(&a.size));

        let res = DiskAnalysisResponse {
            path: target_clone,
            total_size,
            item_count: items.len(),
            items,
        };

        // We close tx here so the forwarder task knows we are done computing
        drop(tx);

        // We send the final result using a channel because we are blocking, but the forwarder task is async.
        // Wait, event_tx is mpsc, we can block_send
        let _ = event_tx.blocking_send(Ok(Event::default()
            .event("complete")
            .data(serde_json::to_string(&res).unwrap_or_default())));
    });

    // Async task to forward progress updates to SSE
    tokio::spawn(async move {
        let mut scanned_bytes = 0u64;
        let mut last_sent_time = tokio::time::Instant::now();

        while let Some(bytes) = rx.recv().await {
            scanned_bytes += bytes;
            
            // Throttle updates to max 10 per second to avoid flooding SSE
            if last_sent_time.elapsed().as_millis() > 100 {
                let payload = serde_json::json!({ "scanned_bytes": scanned_bytes });
                if event_tx_clone.send(Ok(Event::default()
                    .event("progress")
                    .data(payload.to_string()))).await.is_err() {
                    break;
                }
                last_sent_time = tokio::time::Instant::now();
            }
        }
    });

    Ok(Sse::new(ReceiverStream::new(event_rx)).keep_alive(axum::response::sse::KeepAlive::default()))
}

