export interface IntegrationsSettings {
  homeassistant: boolean;
  pihole: boolean;
}

export interface SystemSettings {
  server_name: string;
  port: number;
  default_page: string;
  metrics_refresh_rate: number;
  show_weather_card: boolean;
  confirm_dangerous_actions: boolean;
  integrations: IntegrationsSettings;
}

export interface PortConflictInfo {
  host_port: number;
  container_port: number;
  protocol: string;
  in_use: boolean;
  in_use_by?: string | null;
  suggested_port: number;
}
