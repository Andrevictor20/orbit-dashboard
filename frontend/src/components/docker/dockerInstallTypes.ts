export interface PortConflictInfo {
  host_port: number;
  container_port: number;
  protocol: string;
  in_use: boolean;
  in_use_by?: string;
  suggested_port: number;
}

export interface ParsedService {
  name: string;
  image: string;
  restart?: string;
  ports: { host_port?: number; container_port: number; protocol: string; raw: string }[];
  volumes: { host_path: string; container_path: string; mode?: string; raw: string }[];
  environment: Record<string, string>;
  command?: string[];
  network?: string;
  privileged: boolean;
}

export interface ParseResponse {
  input_type: 'docker_run' | 'docker_compose';
  app_name: string;
  image: string;
  services: ParsedService[];
  compose_yaml: string;
  port_conflicts: PortConflictInfo[];
}

export interface DockerInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (appName: string) => void;
}
