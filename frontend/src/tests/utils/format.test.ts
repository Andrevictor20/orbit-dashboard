import { describe, it, expect } from 'vitest';
import { getFriendlyDiskName, getDiskCategoryInfo, isPhysicalStorage, formatBytes, formatRAM, formatGB, formatStorage, formatNetworkSpeed } from '../../utils/format';

describe('Format and Storage Utils', () => {
  it('formats bytes, RAM, GB and TB correctly', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1024)).toBe('1 KB');
    expect(formatBytes(1024 * 1024)).toBe('1 MB');
    expect(formatBytes(1024 * 1024 * 1024 * 1024)).toBe('1 TB');
    expect(formatRAM(512 * 1024 * 1024)).toBe('512.0 MB');
    expect(formatRAM(2 * 1024 * 1024 * 1024)).toBe('2.00 GB');
    
    // Below 1 TB -> displays in GB
    expect(formatGB(4 * 1024 * 1024 * 1024)).toBe('4.00 GB');
    expect(formatStorage(500 * 1024 * 1024 * 1024)).toBe('500.0 GB');
    
    // At or above 1 TB (1024 GB) -> displays in TB
    expect(formatGB(1024 * 1024 * 1024 * 1024)).toBe('1.00 TB');
    expect(formatGB(2 * 1024 * 1024 * 1024 * 1024)).toBe('2.00 TB');
    expect(formatStorage(1024 * 1024 * 1024 * 1024)).toBe('1.0 TB');
    expect(formatStorage(1536 * 1024 * 1024 * 1024, 2)).toBe('1.50 TB');
    expect(formatStorage(4096 * 1024 * 1024 * 1024)).toBe('4.0 TB');
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

  it('filters out pseudo-filesystems and virtual mounts via isPhysicalStorage', () => {
    expect(isPhysicalStorage('securityfs', '/sys/kernel/security', 'securityfs', 0)).toBe(false);
    expect(isPhysicalStorage('efivarfs', '/sys/firmware/efi/efivars', 'efivarfs', 1000)).toBe(false);
    expect(isPhysicalStorage('bpf', '/sys/fs/bpf', 'bpf', 0)).toBe(false);
    expect(isPhysicalStorage('tmpfs', '/run', 'tmpfs', 1024 * 1024 * 100)).toBe(false);
    expect(isPhysicalStorage('overlay', '/', 'overlay', 1024 * 1024 * 1024 * 100)).toBe(false);
    
    // Boot / EFI small partitions (e.g. 1.0 GB or 0.6 GB boot partitions) must be filtered out
    expect(isPhysicalStorage('/dev/nvme0n1p1', '/boot/efi', 'vfat', 1024 * 1024 * 1024)).toBe(false);
    expect(isPhysicalStorage('/dev/nvme0n1p2', '/boot', 'ext4', 600 * 1024 * 1024)).toBe(false);
    expect(isPhysicalStorage('pi-boot', '/media/pi-boot', 'external', 0)).toBe(false);
    
    // Real physical storage (large partitions, e.g. 500 GB or 1 TB)
    expect(isPhysicalStorage('/dev/nvme0n1p3', '/', 'ext4', 500 * 1024 * 1024 * 1024)).toBe(true);
    expect(isPhysicalStorage('/dev/sda1', '/mnt/backup', 'ntfs', 1000 * 1024 * 1024 * 1024)).toBe(true);
  });

  it('correctly classifies storage category and type labels for NVMe, microSD, external and SATA drives', () => {
    expect(getDiskCategoryInfo('/dev/nvme0n1p1', '/')).toEqual({
      friendlyName: 'SSD NVMe',
      category: 'nvme',
      typeLabel: 'NVMe',
    });
    expect(getDiskCategoryInfo('/dev/mmcblk0p1', '/')).toEqual({
      friendlyName: 'Cartão microSD',
      category: 'sdcard',
      typeLabel: 'microSD',
    });
    expect(getDiskCategoryInfo('/dev/sdb1', '/mnt/dados')).toEqual({
      friendlyName: 'HD Externo (dados)',
      category: 'external',
      typeLabel: 'HD Externo',
    });
  });

  it('formats network speed dynamically with appropriate units', () => {
    expect(formatNetworkSpeed(0)).toBe('0 B/s');
    expect(formatNetworkSpeed(undefined)).toBe('0 B/s');
    expect(formatNetworkSpeed(500)).toBe('500 B/s');
    expect(formatNetworkSpeed(1024)).toBe('1.0 KB/s');
    expect(formatNetworkSpeed(51200)).toBe('50.0 KB/s');
    expect(formatNetworkSpeed(10 * 1024 * 1024)).toBe('10.0 MB/s');
    expect(formatNetworkSpeed(1.5 * 1024 * 1024 * 1024)).toBe('1.5 GB/s');
  });
});
