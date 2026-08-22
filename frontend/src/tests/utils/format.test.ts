import { describe, it, expect } from 'vitest';
import { getFriendlyDiskName, formatBytes, formatRAM, formatGB } from '../../utils/format';

describe('Format and Storage Utils', () => {
  it('formats bytes, RAM and GB correctly', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(1024 * 1024)).toBe('1 MB');
    expect(formatRAM(512 * 1024 * 1024)).toBe('512.0 MB');
    expect(formatGB(4 * 1024 * 1024 * 1024)).toBe('4.00 GB');
  });

  it('classifies microSD cards', () => {
    expect(getFriendlyDiskName('/dev/mmcblk0p2', '/')).toBe('Cartão microSD');
    expect(getFriendlyDiskName('mmcblk0', '/etc/resolv.conf')).toBe('Cartão microSD');
  });

  it('classifies NVMe SSDs', () => {
    expect(getFriendlyDiskName('/dev/nvme0n1p1', '/')).toBe('SSD NVMe');
  });

  it('classifies external HD and USB drives mounted in /mnt and /media', () => {
    expect(getFriendlyDiskName('/dev/sda1', '/mnt/backup_hd')).toBe('HD Externo (backup_hd)');
    expect(getFriendlyDiskName('/dev/sdb1', '/media/pendrive')).toBe('HD Externo (pendrive)');
  });

  it('classifies system primary disk on root mount', () => {
    expect(getFriendlyDiskName('/dev/sda1', '/')).toBe('SSD / HD Principal');
    expect(getFriendlyDiskName('/dev/root', '/')).toBe('Armazenamento do Sistema');
  });
});
