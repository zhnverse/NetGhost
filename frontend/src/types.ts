export interface Connection {
  id: number;
  timestamp: number;
  src_ip: string;
  dst_ip: string;
  src_port: number;
  dst_port: number;
  protocol: string;
  bytes: number;
  packets: number;
  src_country: string | null;
  src_city: string | null;
  src_lat: number | null;
  src_lon: number | null;
  dst_country: string | null;
  dst_city: string | null;
  dst_lat: number | null;
  dst_lon: number | null;
  is_threat: number;
  threat_type: string;
  threat_score: number;
  threat_desc?: string;
  hostname: string | null;
  is_demo?: boolean;
}

export interface Threat {
  id: number;
  timestamp: number;
  ip: string;
  threat_type: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  connection_id: number;
}

export interface Status {
  status: string;
  demo_mode: boolean;
  total_connections: number;
  total_threats: number;
  threat_events: number;
  ws_clients: number;
  bytes_sent: number;
  bytes_recv: number;
}

export interface GeoStat {
  country: string;
  count: number;
  bytes: number;
  threats: number;
}

export interface TimelinePoint {
  bucket: number;
  count: number;
  threats: number;
  bytes: number;
}

export interface ProtocolStat {
  protocol: string;
  count: number;
  bytes: number;
}

export interface TopIP {
  ip: string;
  country: string | null;
  count: number;
  bytes: number;
  is_threat: number;
}

export type Tab = 'globe' | 'feed' | 'threats' | 'stats' | 'hunt';
