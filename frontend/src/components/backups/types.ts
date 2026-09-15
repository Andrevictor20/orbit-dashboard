import type { LucideIcon } from 'lucide-react';

export interface BackupItem {
  id?: string;
  app_id?: string;
  filename: string;
  app_name: string;
  size_bytes: number;
  created_at: string;
  app_dir_exists?: boolean;
  target_type?: string;
  backup_type?: string;
  description?: string;
}

export interface BackupVisuals {
  icon: LucideIcon;
  badge: string;
  badgeColor: string;
  avatarColor: string;
}
