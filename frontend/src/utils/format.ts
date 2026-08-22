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
