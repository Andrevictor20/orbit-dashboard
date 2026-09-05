/**
 * Shared formatting utilities used across multiple components.
 * Centralizing prevents code duplication between ContainerList, ContainerDetail, etc.
 */

/**
 * Formats bytes as a human-readable string (B, KB, MB, GB, TB).
 */
export function formatBytes(bytes?: number): string {
  if (bytes === undefined || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Formats bytes as MB with 1 decimal, or GB with 2 decimals if >= 1 GB (for RAM display).
 */
export function formatRAM(bytes?: number): string {
  if (bytes === undefined) return '0 MB';
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Formats storage capacity or usage dynamically in GB or TB.
 * When storage reaches 1 TB (1024 GB) or higher, it formats in TB instead of GB.
 */
export function formatStorage(bytes?: number, decimals: number = 1): string {
  if (bytes === undefined || bytes === 0) return `0.${'0'.repeat(Math.max(0, decimals - 1))} GB`.replace('.0 ', ' ').trim();
  const gb = 1024 * 1024 * 1024;
  const tb = 1024 * 1024 * 1024 * 1024;
  if (bytes >= tb) {
    return `${(bytes / tb).toFixed(decimals)} TB`;
  }
  return `${(bytes / gb).toFixed(decimals)} GB`;
}

/**
 * Formats bytes as GB or TB with 2 decimals (for disk/total storage display).
 */
export function formatGB(bytes: number): string {
  const tb = 1024 * 1024 * 1024 * 1024;
  if (bytes >= tb) {
    return `${(bytes / tb).toFixed(2)} TB`;
  }
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

/**
 * Determines whether a given mount/disk is a real physical user storage drive
 * (SSD, HD, Pendrive, SD Card) and filters out pseudo/virtual filesystems,
 * boot/efi partitions (< 5GB), and fake 0-byte directory mappings.
 */
export function isPhysicalStorage(
  name?: string,
  mountPoint?: string,
  fsType?: string,
  totalBytes?: number
): boolean {
  const n = (name || '').toLowerCase();
  const m = (mountPoint || '').toLowerCase();
  const f = (fsType || '').toLowerCase();

  // Pseudo / virtual filesystems blacklist
  const pseudoFs = [
    'securityfs',
    'efivarfs',
    'bpf',
    'configfs',
    'selinuxfs',
    'debugfs',
    'cgroup',
    'cgroup2',
    'pstore',
    'hugetlbfs',
    'mqueue',
    'autofs',
    'tracefs',
    'fusectl',
    'binfmt_misc',
    'devtmpfs',
    'devpts',
    'proc',
    'sysfs',
    'tmpfs',
    'squashfs',
    'overlay',
    'overlayfs',
    'nsfs',
    'rpc_pipefs',
    'fuse.gvfsd-fuse',
    'gvfsd-fuse',
    'fuse.portal',
    'portal',
    'pipefs',
    'sockfs'
  ];

  if (pseudoFs.includes(f) || pseudoFs.includes(n)) {
    return false;
  }

  // Filter out system kernel and runtime mount paths, plus boot/efi internal partitions
  if (
    m.startsWith('/sys') ||
    m.startsWith('/proc') ||
    m.startsWith('/dev') ||
    m.startsWith('/run') ||
    m.startsWith('/var/run') ||
    m.startsWith('/etc') ||
    m.startsWith('/tmp') ||
    m.startsWith('/boot') ||
    m.startsWith('/efi') ||
    m.startsWith('/recovery') ||
    m.startsWith('/var/lib/docker') ||
    m.startsWith('/var/lib/containers') ||
    m === '/app/data' ||
    m.startsWith('/host/sys') ||
    m.startsWith('/host/proc') ||
    m.startsWith('/host/dev') ||
    m.startsWith('/host/run') ||
    m.startsWith('/host/etc') ||
    m.startsWith('/host/tmp') ||
    m.startsWith('/host/boot') ||
    m.startsWith('/host/efi') ||
    m.startsWith('/host/recovery') ||
    m.startsWith('/host/var/lib/docker')
  ) {
    return false;
  }

  // Filter out fake/empty mounts (0 bytes) or small partitions (< 2GB)
  if (totalBytes !== undefined && totalBytes < 2 * 1024 * 1024 * 1024) {
    return false;
  }

  return true;
}

/**
 * Classifies a storage device and returns a user-friendly, clean label.
 * e.g., 'Cartão microSD', 'SSD NVMe', 'HD Externo', 'Pendrive USB', 'Armazenamento do Sistema'
 */
export function getFriendlyDiskName(name?: string, mountPoint?: string): string {
  const n = (name || '').toLowerCase();
  const m = (mountPoint || '').toLowerCase();

  if (n.includes('mmcblk') || n.includes('sdcard')) {
    return 'Cartão microSD';
  }
  if (n.includes('nvme')) {
    return 'SSD NVMe';
  }
  if (m.startsWith('/mnt') || m.startsWith('/media') || m.startsWith('/run/media') || m.startsWith('/host/mnt') || m.startsWith('/host/media')) {
    const mountFolder = mountPoint?.split('/').filter(s => s && s !== 'host' && s !== 'mnt' && s !== 'media' && s !== 'run').pop();
    return mountFolder ? `HD Externo (${mountFolder})` : 'HD / Armazenamento Externo';
  }
  if (n.startsWith('/dev/sd') || n.startsWith('sd')) {
    if (m === '/' || m === '/root' || m === '/home' || m === '/host') {
      return 'SSD / HD Principal';
    }
    return 'Pendrive / HD USB';
  }
  if (m === '/' || m === '/root' || m === '/host' || n === 'root' || n === '/dev/root') {
    return 'Armazenamento do Sistema';
  }
  return name && !name.startsWith('/dev/') && !name.startsWith('/') ? name : 'Armazenamento do Sistema';
}

export interface DiskCategoryInfo {
  friendlyName: string;
  category: 'nvme' | 'sdcard' | 'external' | 'system' | 'usb';
  typeLabel: string;
}

export function getDiskCategoryInfo(name?: string, mountPoint?: string): DiskCategoryInfo {
  const n = (name || '').toLowerCase();
  const m = (mountPoint || '').toLowerCase();
  const friendlyName = getFriendlyDiskName(name, mountPoint);

  if (n.includes('mmcblk') || n.includes('sdcard')) {
    return {
      friendlyName,
      category: 'sdcard',
      typeLabel: 'microSD',
    };
  }
  if (n.includes('nvme')) {
    return {
      friendlyName,
      category: 'nvme',
      typeLabel: 'NVMe',
    };
  }
  if (m.startsWith('/mnt') || m.startsWith('/media') || m.startsWith('/run/media') || m.startsWith('/host/mnt') || m.startsWith('/host/media')) {
    return {
      friendlyName,
      category: 'external',
      typeLabel: 'HD Externo',
    };
  }
  if (n.startsWith('/dev/sd') || n.startsWith('sd')) {
    if (m === '/' || m === '/root' || m === '/home' || m === '/host') {
      return {
        friendlyName,
        category: 'system',
        typeLabel: 'SSD / HD',
      };
    }
    return {
      friendlyName,
      category: 'usb',
      typeLabel: 'USB / HD',
    };
  }
  return {
    friendlyName,
    category: 'system',
    typeLabel: 'Armazenamento',
  };
}

/**
 * Formats network transfer rate in bytes per second dynamically (B/s, KB/s, MB/s, GB/s).
 */
export function formatNetworkSpeed(bytesPerSec?: number): string {
  if (bytesPerSec === undefined || bytesPerSec === null || isNaN(bytesPerSec) || bytesPerSec <= 0) {
    return '0 B/s';
  }
  const k = 1024;
  if (bytesPerSec < k) {
    return `${Math.round(bytesPerSec)} B/s`;
  }
  const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s', 'TB/s'];
  const i = Math.min(sizes.length - 1, Math.floor(Math.log(bytesPerSec) / Math.log(k)));
  return `${(bytesPerSec / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}
