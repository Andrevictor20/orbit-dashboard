export interface PiHoleConfig {
  configured: boolean;
  connected: boolean;
  url: string;
  status?: 'enabled' | 'disabled' | string | null;
  version?: 'v6' | 'v5' | string | null;
  error?: string | null;
}

export interface PiHoleStats {
  domains_being_blocked?: number;
  dns_queries_today?: number;
  ads_blocked_today?: number;
  ads_percentage_today?: number;
  unique_domains?: number;
  queries_forwarded?: number;
  queries_cached?: number;
  clients_ever_seen?: number;
  unique_clients?: number;
  dns_queries_all_types?: number;
  status?: 'enabled' | 'disabled' | string;
  gravity_last_updated?: {
    file_exists?: boolean;
    absolute?: number;
    relative?: {
      days?: number;
      hours?: number;
      minutes?: number;
    };
  };
  top_queries?: Record<string, number>;
  top_ads?: Record<string, number>;
}

export interface PiHoleDomainItem {
  domain: string;
  list_type: 'white' | 'black';
  enabled: boolean;
}

export type PiHoleTab = 'overview' | 'domains';
