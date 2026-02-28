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
  static_host_count: number
  dhcp_pool_total_size: number
  created_at: string
  updated_at: string
}

export interface DeviceTypeOption {
  id: number
  value: string
  label: string
  color: string
  position: number
}

export interface Host {
  id: number
  subnet: number
  ip_address: string
  hostname: string
  mac_address: string
  device_type: string
  ip_type: 'static' | 'dhcp_lease'
  dhcp_pool: number | null
  description: string
  created_at: string
  updated_at: string
}

export interface DHCPPool {
  id: number
  subnet: number
  start_ip: string
  end_ip: string
  description: string
  lease_count: number
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
  device_type: string
  ip_type: 'static' | 'dhcp_lease'
  dhcp_pool: number | null
}

export interface DHCPPoolTopology {
  id: number
  start_ip: string
  end_ip: string
  description: string
  leases: HostTopology[]
}

export interface SubnetTopology {
  id: number
  network: string
  gateway: string | null
  description: string
  hosts: HostTopology[]
  dhcp_pools: DHCPPoolTopology[]
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

// Port Profiles
export interface PortProfile {
  id: number
  name: string
  description: string
  entry_count: number
}

// Physical topology types (L1)
export interface PortTemplate {
  id: number
  profile: number
  name: string
  port_type: string
  position: number
}

export interface DevicePort {
  id: number
  host: number | null
  patch_panel: number | null
  name: string
  port_type: string
  position: number
  description: string
  cable: { id: number; cable_type: string; label: string } | null
}

export interface PatchPanel {
  id: number
  site: number
  name: string
  port_count: number
  description: string
  port_count_current: number
  created_at: string
  updated_at: string
}

export interface Cable {
  id: number
  port_a: number
  port_b: number
  cable_type: string
  label: string
  port_a_display: string
  port_b_display: string
  created_at: string
  updated_at: string
}

export interface PhysicalTopology {
  hosts: PhysicalHost[]
  patch_panels: PhysicalPatchPanel[]
  cables: PhysicalCable[]
}

export interface PhysicalHost {
  id: number
  ip_address: string
  hostname: string
  device_type: string
  ports: { id: number; name: string; port_type: string; position: number }[]
}

export interface PhysicalPatchPanel {
  id: number
  name: string
  ports: { id: number; name: string; port_type: string; position: number }[]
}

export interface PhysicalCable {
  id: number
  port_a: number
  port_b: number
  cable_type: string
  label: string
  port_a_device: { type: string; id: number; name: string; site_id: number } | null
  port_b_device: { type: string; id: number; name: string; site_id: number } | null
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
