export interface PiHoleConfig {
  configured: boolean;
  connected: boolean;
  url: string;
  status?: 'enabled' | 'disabled' | string | null;
  version?: 'v6' | 'v5' | string | null;
  error?: string | null;
}

export interface PiHoleClientItem {
  ip: string;
  name: string;
  count: number;
  percentage: number;
}

export interface PiHoleUpstreamItem {
  destination: string;
  name: string;
  count: number;
  percentage: number;
}

export interface PiHoleRecentQueryItem {
  timestamp: number;
  time: string;
  query_type: string;
  domain: string;
  client: string;
  status: 'blocked' | 'forwarded' | 'cached' | string;
  reply?: string;
}

export interface PiHoleStats {
  domains_being_blocked?: number;
  dns_queries_today?: number;
  ads_blocked_today?: number;
  ads_percentage_today?: number;
  unique_domains?: number;
  queries_forwarded?: number;
  queries_cached?: number;
  cache_percentage?: number;
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
  top_clients?: PiHoleClientItem[];
  upstreams?: PiHoleUpstreamItem[];
  query_types?: Record<string, number>;
  recent_queries?: PiHoleRecentQueryItem[];
}

export interface PiHoleDomainItem {
  domain: string;
  list_type: 'white' | 'black';
  enabled: boolean;
}

export type PiHoleTab = 'overview' | 'domains';

