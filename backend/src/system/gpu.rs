use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use std::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
pub struct GpuTelemetry {
    pub name: String,
    pub vendor: String,
    pub usage_percent: f32,
    pub memory_used_bytes: u64,
    pub memory_total_bytes: u64,
    pub temperature_c: Option<f32>,
    pub is_available: bool,
}

/// Discovers and collects real-time GPU telemetry across AMD, NVIDIA, Intel, Raspberry Pi VideoCore, or DRM cards.
pub fn collect_gpu_telemetry() -> GpuTelemetry {
    // 1. Try AMD GPU via sysfs (native Linux DRM kernel interface)
    if let Some(amd) = collect_amd_gpu() {
        return amd;
    }

    // 2. Try NVIDIA GPU via nvidia-smi
    if let Some(nvidia) = collect_nvidia_gpu() {
        return nvidia;
    }

    // 3. Try Intel GPU via sysfs
    if let Some(intel) = collect_intel_gpu() {
        return intel;
    }

    // 4. Try Raspberry Pi VideoCore GPU via vcgencmd
    if let Some(rpi) = collect_rpi_gpu() {
        return rpi;
    }

    // 5. Generic DRM fallback
    if let Some(generic) = collect_generic_drm_gpu() {
        return generic;
    }

    GpuTelemetry {
        name: "GPU Integrada / Não detectada".to_string(),
        vendor: "Generic".to_string(),
        usage_percent: 0.0,
        memory_used_bytes: 0,
        memory_total_bytes: 0,
        temperature_c: None,
        is_available: false,
    }
}

/// Reads AMD GPU metrics from /sys/class/drm/card*/device/
fn collect_amd_gpu() -> Option<GpuTelemetry> {
    let drm_dir = Path::new("/sys/class/drm");
    let entries = fs::read_dir(drm_dir).ok()?;

    for entry in entries.flatten() {
        let name = entry.file_name();
        let name_str = name.to_string_lossy();
        if !name_str.starts_with("card") || name_str.contains('-') {
            continue;
        }

        let dev_dir = entry.path().join("device");
        if !dev_dir.exists() {
            continue;
        }

        let busy_path = dev_dir.join("gpu_busy_percent");
        if !busy_path.exists() {
            continue;
        }

        // Found AMD GPU!
        let usage_percent = fs::read_to_string(&busy_path)
            .ok()
            .and_then(|s| s.trim().parse::<f32>().ok())
            .unwrap_or(0.0)
            .clamp(0.0, 100.0);

        let mem_used = fs::read_to_string(dev_dir.join("mem_info_vram_used"))
            .ok()
            .and_then(|s| s.trim().parse::<u64>().ok())
            .unwrap_or(0);

        let mem_total = fs::read_to_string(dev_dir.join("mem_info_vram_total"))
            .ok()
            .and_then(|s| s.trim().parse::<u64>().ok())
            .unwrap_or(0);

        let temp_c = find_hwmon_temp(&dev_dir);

        let model_name = parse_amd_model_name(&dev_dir);

        return Some(GpuTelemetry {
            name: model_name,
            vendor: "AMD".to_string(),
            usage_percent,
            memory_used_bytes: mem_used,
            memory_total_bytes: mem_total,
            temperature_c: temp_c,
            is_available: true,
        });
    }

    None
}

/// Discovers temperature in hwmon child directory
fn find_hwmon_temp(dev_dir: &Path) -> Option<f32> {
    let hwmon_dir = dev_dir.join("hwmon");
    if let Ok(entries) = fs::read_dir(hwmon_dir) {
        for entry in entries.flatten() {
            let p = entry.path();
            for temp_name in &["temp1_input", "temp2_input"] {
                let temp_path = p.join(temp_name);
                if let Ok(val_str) = fs::read_to_string(&temp_path) {
                    if let Ok(milli) = val_str.trim().parse::<f32>() {
                        if milli > 0.0 {
                            return Some((milli / 1000.0 * 10.0).round() / 10.0);
                        }
                    }
                }
            }
        }
    }
    None
}

/// Identifies AMD GPU model name
fn parse_amd_model_name(dev_dir: &Path) -> String {
    if let Ok(content) = fs::read_to_string(dev_dir.join("product_name")) {
        let clean = content.trim();
        if !clean.is_empty() {
            return clean.to_string();
        }
    }

    // Try reading vendor/device IDs from uevent
    if let Ok(uevent) = fs::read_to_string(dev_dir.join("uevent")) {
        for line in uevent.lines() {
            if line.starts_with("PCI_ID=") {
                let id = line.trim_start_matches("PCI_ID=");
                if id.to_lowercase().starts_with("1002:") {
                    return "AMD Radeon Graphics".to_string();
                }
            }
        }
    }

    "AMD Radeon Graphics".to_string()
}

/// Collects NVIDIA GPU telemetry using nvidia-smi command
fn collect_nvidia_gpu() -> Option<GpuTelemetry> {
    let output = Command::new("nvidia-smi")
        .args([
            "--query-gpu=name,utilization.gpu,memory.used,memory.total,temperature.gpu",
            "--format=csv,noheader,nounits",
        ])
        .output()
        .ok()?;

    if !output.status.success() {
        return None;
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let line = stdout.lines().next()?;
    let parts: Vec<&str> = line.split(',').map(|s| s.trim()).collect();
    if parts.len() < 5 {
        return None;
    }

    let name = parts[0].to_string();
    let usage: f32 = parts[1].parse().unwrap_or(0.0);
    let mem_used_mb: u64 = parts[2].parse().unwrap_or(0);
    let mem_total_mb: u64 = parts[3].parse().unwrap_or(0);
    let temp_c: Option<f32> = parts[4].parse().ok();

    Some(GpuTelemetry {
        name,
        vendor: "NVIDIA".to_string(),
        usage_percent: usage,
        memory_used_bytes: mem_used_mb * 1024 * 1024,
        memory_total_bytes: mem_total_mb * 1024 * 1024,
        temperature_c: temp_c,
        is_available: true,
    })
}

/// Collects Intel GPU metrics from /sys/class/drm/card*/device/
fn collect_intel_gpu() -> Option<GpuTelemetry> {
    let drm_dir = Path::new("/sys/class/drm");
    let entries = fs::read_dir(drm_dir).ok()?;

    for entry in entries.flatten() {
        let name = entry.file_name();
        let name_str = name.to_string_lossy();
        if !name_str.starts_with("card") || name_str.contains('-') {
            continue;
        }

        let dev_dir = entry.path().join("device");
        let driver_path = dev_dir.join("driver");
        if let Ok(driver_target) = fs::read_link(driver_path) {
            let driver_str = driver_target.to_string_lossy();
            if driver_str.ends_with("i915") || driver_str.ends_with("xe") {
                let temp_c = find_hwmon_temp(&dev_dir);
                return Some(GpuTelemetry {
                    name: "Intel HD/Iris/Arc Graphics".to_string(),
                    vendor: "Intel".to_string(),
                    usage_percent: 0.0,
                    memory_used_bytes: 0,
                    memory_total_bytes: 0,
                    temperature_c: temp_c,
                    is_available: true,
                });
            }
        }
    }

    None
}

/// Generic DRM fallback if any card exists
fn collect_generic_drm_gpu() -> Option<GpuTelemetry> {
    let drm_dir = Path::new("/sys/class/drm");
    let entries = fs::read_dir(drm_dir).ok()?;

    for entry in entries.flatten() {
        let name = entry.file_name();
        let name_str = name.to_string_lossy();
        if name_str.starts_with("card") && !name_str.contains('-') {
            let dev_dir = entry.path().join("device");
            let temp_c = find_hwmon_temp(&dev_dir);
            return Some(GpuTelemetry {
                name: "Dispositivo Gráfico / DRM".to_string(),
                vendor: "Generic".to_string(),
                usage_percent: 0.0,
                memory_used_bytes: 0,
                memory_total_bytes: 0,
                temperature_c: temp_c,
                is_available: true,
            });
        }
    }

    None
}

/// Collects Raspberry Pi VideoCore GPU telemetry using vcgencmd.
/// Works on Pi 2/3/4/5 and Zero W with the firmware tools installed.
fn collect_rpi_gpu() -> Option<GpuTelemetry> {
    // Check if vcgencmd is available
    let probe = Command::new("vcgencmd")
        .arg("version")
        .output();
    if probe.is_err() || !probe.unwrap().status.success() {
        return None;
    }

    // Get V3D clock frequency to estimate GPU activity (Hz)
    let v3d_clock_hz: u64 = Command::new("vcgencmd")
        .args(["measure_clock", "v3d"])
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .and_then(|s| {
            // Format: "frequency(46)=250000000"
            s.split('=').nth(1).and_then(|v| v.trim().parse().ok())
        })
        .unwrap_or(0);

    // Get core clock (nominal max) for usage percentage
    let core_clock_hz: u64 = Command::new("vcgencmd")
        .args(["measure_clock", "core"])
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .and_then(|s| s.split('=').nth(1).and_then(|v| v.trim().parse().ok()))
        .unwrap_or(1);

    // Estimate GPU usage as v3d_clock / core_clock (rough proxy)
    let usage_percent = if core_clock_hz > 0 {
        ((v3d_clock_hz as f32 / core_clock_hz as f32) * 100.0).clamp(0.0, 100.0)
    } else {
        0.0
    };

    // Get GPU memory split (in MB)
    let gpu_mem_mb: u64 = Command::new("vcgencmd")
        .args(["get_mem", "gpu"])
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .and_then(|s| {
            // Format: "gpu=128M"
            s.split('=')
                .nth(1)
                .and_then(|v| v.trim().trim_end_matches('M').parse::<u64>().ok())
        })
        .unwrap_or(0);

    // Get GPU temperature
    let temp_c: Option<f32> = Command::new("vcgencmd")
        .args(["measure_temp"])
        .output()
        .ok()
        .and_then(|o| String::from_utf8(o.stdout).ok())
        .and_then(|s| {
            // Format: "temp=54.3'C"
            s.split('=')
                .nth(1)
                .and_then(|v| v.trim().trim_end_matches("'C").parse::<f32>().ok())
        });

    // Detect Pi model name from /proc/cpuinfo
    let model = std::fs::read_to_string("/proc/cpuinfo")
        .ok()
        .and_then(|s| {
            s.lines()
                .find(|l| l.starts_with("Model"))
                .and_then(|l| l.split(':').nth(1))
                .map(|s| s.trim().to_string())
        })
        .unwrap_or_else(|| "Raspberry Pi".to_string());

    let gpu_name = format!("{} VideoCore", model);

    Some(GpuTelemetry {
        name: gpu_name,
        vendor: "Broadcom".to_string(),
        usage_percent,
        memory_used_bytes: 0, // VideoCore doesn't expose used VRAM separately
        memory_total_bytes: gpu_mem_mb * 1024 * 1024,
        temperature_c: temp_c,
        is_available: true,
    })
}

pub async fn get_gpu_handler() -> impl axum::response::IntoResponse {
    let telemetry = collect_gpu_telemetry();
    (axum::http::StatusCode::OK, axum::Json(telemetry))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_collect_gpu_telemetry_returns_valid_struct() {
        let gpu = collect_gpu_telemetry();
        assert!(!gpu.name.is_empty());
        assert!(!gpu.vendor.is_empty());
        assert!(gpu.usage_percent >= 0.0 && gpu.usage_percent <= 100.0);
    }
}
