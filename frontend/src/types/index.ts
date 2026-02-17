export interface User {
  id: number
  username: string
  email: string
  role: 'admin' | 'editor' | 'viewer'
  first_name: string
  last_name: string
  is_active?: boolean
}

export interface UserAdmin {
  id: number
  username: string
  email: string
  role: 'admin' | 'editor' | 'viewer'
  first_name: string
  last_name: string
  is_active: boolean
  password?: string
}

export interface Project {
  id: number
  name: string
  description: string
  supernet: string | null
  created_by: number | null
  created_by_username: string | null
  site_count: number
  created_at: string
  updated_at: string
}

export interface SiteWanAddress {
  id?: number
  ip_address: string
  label: string
}

export interface Site {
  id: number
  project: number
  name: string
  address: string
  supernet: string | null
  latitude: number | null
  longitude: number | null
  vlan_count: number
  host_count: number
  wan_addresses: SiteWanAddress[]
  created_at: string
  updated_at: string
}

export interface VLAN {
  id: number
  site: number
  vlan_id: number
  name: string
  purpose: string
  description: string
  subnet_count: number
  host_count: number
  created_at: string
  updated_at: string
}

export interface Subnet {
  id: number
  project: number
  site: number
  vlan: number | null
  network: string
  gateway: string | null
  description: string
  host_count: number
  created_at: string
  updated_at: string
}

export type DeviceType = 'server' | 'router' | 'switch' | 'firewall' | 'ap' | 'nas' | 'camera' | 'printer' | 'phone' | 'workstation' | 'other'

export interface Host {
  id: number
  subnet: number
  ip_address: string
  hostname: string
  mac_address: string
  device_type: DeviceType
  description: string
  created_at: string
  updated_at: string
}

export type TunnelType = 'gre' | 'ipsec' | 'vxlan' | 'wireguard'

export interface Tunnel {
  id: number
  project: number
  name: string
  tunnel_type: TunnelType
  tunnel_subnet: string
  site_a: number
  site_a_name: string
  ip_a: string
  site_b: number | null
  site_b_name: string | null
  site_b_project_id: number | null
  site_b_project_name: string | null
  ip_b: string
  external_endpoint: string
  enabled: boolean
  description: string
  created_at: string
  updated_at: string
}

// Topology types (nested read-only from /api/v1/projects/{id}/topology/)
export interface HostTopology {
  id: number
  ip_address: string
  hostname: string
  device_type: DeviceType
}

export interface SubnetTopology {
  id: number
  network: string
  gateway: string | null
  description: string
  hosts: HostTopology[]
}

export interface VLANTopology {
  id: number
  vlan_id: number
  name: string
  purpose: string
  subnets: SubnetTopology[]
}

export interface SiteTopology {
  id: number
  name: string
  address: string
  latitude: number | null
  longitude: number | null
  wan_addresses: SiteWanAddress[]
  vlans: VLANTopology[]
  standalone_subnets: SubnetTopology[]
}

export interface TunnelTopology {
  id: number
  project: number
  name: string
  tunnel_type: TunnelType
  tunnel_subnet: string
  site_a: number
  site_a_name: string
  ip_a: string
  site_b: number | null
  site_b_name: string | null
  site_b_project_id: number | null
  site_b_project_name: string | null
  site_b_latitude: number | null
  site_b_longitude: number | null
  ip_b: string
  external_endpoint: string
  enabled: boolean
}

export interface ProjectTopology {
  sites: SiteTopology[]
  tunnels: TunnelTopology[]
}

// Search
export interface SearchResult {
  type: 'host' | 'subnet' | 'vlan' | 'site' | 'project'
  id: number
  label: string
  secondary: string
  breadcrumb: string
  project_id: number
  site_id?: number
  vlan_id?: number
  subnet_id?: number
}

// Paginated response
export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

// Audit
export interface AuditLog {
  id: number
  username: string | null
  action: 'create' | 'update' | 'delete'
  content_type: number
  object_id: number
  object_repr: string
  changes: Record<string, unknown>
  project_id: number | null
  timestamp: string
}
