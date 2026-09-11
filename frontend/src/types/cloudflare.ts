export interface DetectedCloudflared {
  container_id: string;
  container_name: string;
  account_id: string | null;
  tunnel_id: string | null;
  has_token: boolean;
  local_config_path: string | null;
  status: string;
}

export interface CloudflareConfigResponse {
  configured: boolean;
  account_id: string;
  tunnel_id: string;
  api_token: string;
  has_api_token: boolean;
  auto_sync_links: boolean;
  enabled: boolean;
  detected: DetectedCloudflared | null;
}

export interface IngressRule {
  hostname: string;
  service: string;
  path?: string | null;
  public_url: string;
  matched_container_id?: string | null;
  matched_container_name?: string | null;
}

export interface CloudflareStatusResponse {
  configured: boolean;
  connected: boolean;
  mode: 'remote' | 'local' | 'none';
  tunnel_name?: string | null;
  tunnel_id?: string | null;
  account_id?: string | null;
  routes_count: number;
  error?: string | null;
  detected_container?: DetectedCloudflared | null;
}

export interface CloudflareTunnelsResponse {
  status: CloudflareStatusResponse;
  rules: IngressRule[];
}

export interface SaveCloudflareConfigRequest {
  api_token?: string;
  account_id?: string;
  tunnel_id?: string;
  auto_sync_links?: boolean;
  enabled?: boolean;
}

export interface SyncLinksResponse {
  synced_count: number;
  synced_links: Record<string, string>;
}

export interface CreateRouteRequest {
  hostname: string;
  service: string;
  path?: string;
  no_tls_verify?: boolean;
}

export interface DeleteRouteRequest {
  hostname: string;
  path?: string;
}

export interface CreateRouteResponse {
  success: boolean;
  message: string;
  dns_created: boolean;
  dns_message?: string | null;
  route: IngressRule;
}

export interface DeleteRouteResponse {
  success: boolean;
  message: string;
}
