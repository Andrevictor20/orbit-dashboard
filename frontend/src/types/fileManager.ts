export interface FileItem {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
  modified: string;
  extension: string;
  is_hidden?: boolean;
  mime_type?: string;
}

export interface MountItem {
  name: string;
  mount_point: string;
  fs_type: string;
  total_bytes: number;
  used_bytes: number;
  available_bytes: number;
}

export interface CloudAccount {
  id: string;
  provider: string;
  name: string;
  mount_point?: string;
}

export interface ShortcutPlace {
  id: string;
  labelKey?: string;
  label?: string;
  path: string;
  icon: string;
}

export interface TrashItem {
  id: string;
  name: string;
  original_path: string;
  trash_path: string;
  is_dir: boolean;
  size: number;
  deleted_at: string;
}

export const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp'];
export const ARCHIVE_EXTENSIONS = ['zip', 'tar', 'gz', 'tgz', 'rar', '7z'];
export const CODE_EXTENSIONS = ['js', 'ts', 'jsx', 'tsx', 'rs', 'py', 'json', 'yaml', 'yml', 'sh', 'html', 'css', 'toml', 'env', 'sql', 'c', 'cpp', 'go'];
