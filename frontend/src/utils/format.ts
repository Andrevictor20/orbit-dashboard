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
 * Formats bytes as MB with 1 decimal (for RAM display).
 */
export function formatRAM(bytes?: number): string {
  if (bytes === undefined) return '0 MB';
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Formats bytes as GB with 2 decimals (for disk/total memory display).
 */
export function formatGB(bytes: number): string {
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

/**
 * Classifies a storage device and returns a user-friendly label.
 * e.g., 'Cartão microSD', 'SSD NVMe', 'HD Externo', 'Pendrive / USB', 'Armazenamento do Sistema'
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
  if (m.startsWith('/mnt') || m.startsWith('/media') || m.startsWith('/run/media')) {
    const mountFolder = mountPoint?.split('/').filter(Boolean).pop();
    return mountFolder ? `HD Externo (${mountFolder})` : 'HD / Armazenamento Externo';
  }
  if (n.startsWith('/dev/sd') || n.startsWith('sd')) {
    if (m === '/' || m === '/root' || m === '/home') {
      return 'SSD / HD Principal';
    }
    return 'HD / Pendrive USB';
  }
  if (m === '/' || m === '/root' || n === 'root' || n === '/dev/root') {
    return 'Armazenamento do Sistema';
  }
  return name && !name.startsWith('/dev/') ? name : 'Armazenamento Local';
}

