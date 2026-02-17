import type {
  Project, Site, VLAN, Subnet, Host, Tunnel, DHCPPool,
  ProjectTopology, SearchResult, PaginatedResponse, AuditLog, User, UserAdmin,
} from '@/types'
import apiClient from './client'

// Auth
export const authApi = {
  login: (username: string, password: string) =>
    apiClient.post<User>('/auth/login/', { username, password }),
  logout: () => apiClient.post('/auth/logout/'),
  me: () => apiClient.get<User>('/auth/me/'),
}

// Projects
export const projectsApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<PaginatedResponse<Project>>('/projects/', { params }),
  get: (id: number) =>
    apiClient.get<Project>(`/projects/${id}/`),
  create: (data: Partial<Project>) =>
    apiClient.post<Project>('/projects/', data),
  update: (id: number, data: Partial<Project>) =>
    apiClient.patch<Project>(`/projects/${id}/`, data),
  delete: (id: number) =>
    apiClient.delete(`/projects/${id}/`),
  topology: (id: number) =>
    apiClient.get<ProjectTopology>(`/projects/${id}/topology/`),
}

// Sites
export const sitesApi = {
  list: (projectId: number, params?: Record<string, string>) =>
    apiClient.get<PaginatedResponse<Site>>(`/projects/${projectId}/sites/`, { params }),
  get: (projectId: number, id: number) =>
    apiClient.get<Site>(`/projects/${projectId}/sites/${id}/`),
  create: (projectId: number, data: Partial<Site>) =>
    apiClient.post<Site>(`/projects/${projectId}/sites/`, data),
  update: (projectId: number, id: number, data: Partial<Site>) =>
    apiClient.patch<Site>(`/projects/${projectId}/sites/${id}/`, data),
  delete: (projectId: number, id: number) =>
    apiClient.delete(`/projects/${projectId}/sites/${id}/`),
}

// VLANs
export const vlansApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<PaginatedResponse<VLAN>>('/vlans/', { params }),
  get: (id: number) =>
    apiClient.get<VLAN>(`/vlans/${id}/`),
  create: (data: Partial<VLAN>) =>
    apiClient.post<VLAN>('/vlans/', data),
  update: (id: number, data: Partial<VLAN>) =>
    apiClient.patch<VLAN>(`/vlans/${id}/`, data),
  delete: (id: number) =>
    apiClient.delete(`/vlans/${id}/`),
}

// Subnets
export const subnetsApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<PaginatedResponse<Subnet>>('/subnets/', { params }),
  get: (id: number) =>
    apiClient.get<Subnet>(`/subnets/${id}/`),
  create: (data: Partial<Subnet>) =>
    apiClient.post<Subnet>('/subnets/', data),
  update: (id: number, data: Partial<Subnet>) =>
    apiClient.patch<Subnet>(`/subnets/${id}/`, data),
  delete: (id: number) =>
    apiClient.delete(`/subnets/${id}/`),
  nextFreeIp: (id: number, poolId?: number) =>
    apiClient.get<{ next_free_ip: string }>(`/subnets/${id}/next-free-ip/`, poolId ? { params: { pool: poolId } } : undefined),
  suggestedPoolRange: (id: number) =>
    apiClient.get<{ start_ip: string; end_ip: string; size: number }>(`/subnets/${id}/suggested-pool-range/`),
}

// Hosts
export const hostsApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<PaginatedResponse<Host>>('/hosts/', { params }),
  get: (id: number) =>
    apiClient.get<Host>(`/hosts/${id}/`),
  create: (data: Partial<Host>) =>
    apiClient.post<Host>('/hosts/', data),
  update: (id: number, data: Partial<Host>) =>
    apiClient.patch<Host>(`/hosts/${id}/`, data),
  delete: (id: number) =>
    apiClient.delete(`/hosts/${id}/`),
}

// DHCP Pools
export const dhcpPoolsApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<PaginatedResponse<DHCPPool>>('/dhcp-pools/', { params }),
  get: (id: number) =>
    apiClient.get<DHCPPool>(`/dhcp-pools/${id}/`),
  create: (data: Partial<DHCPPool>) =>
    apiClient.post<DHCPPool>('/dhcp-pools/', data),
  update: (id: number, data: Partial<DHCPPool>) =>
    apiClient.patch<DHCPPool>(`/dhcp-pools/${id}/`, data),
  delete: (id: number) =>
    apiClient.delete(`/dhcp-pools/${id}/`),
}

// Tunnels
export const tunnelsApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<PaginatedResponse<Tunnel>>('/tunnels/', { params }),
  get: (id: number) =>
    apiClient.get<Tunnel>(`/tunnels/${id}/`),
  create: (data: Partial<Tunnel>) =>
    apiClient.post<Tunnel>('/tunnels/', data),
  update: (id: number, data: Partial<Tunnel>) =>
    apiClient.patch<Tunnel>(`/tunnels/${id}/`, data),
  delete: (id: number) =>
    apiClient.delete(`/tunnels/${id}/`),
}

// Users (admin)
export const usersApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<PaginatedResponse<UserAdmin>>('/users/', { params }),
  get: (id: number) =>
    apiClient.get<UserAdmin>(`/users/${id}/`),
  create: (data: Partial<UserAdmin>) =>
    apiClient.post<UserAdmin>('/users/', data),
  update: (id: number, data: Partial<UserAdmin>) =>
    apiClient.patch<UserAdmin>(`/users/${id}/`, data),
  delete: (id: number) =>
    apiClient.delete(`/users/${id}/`),
}

// Search
export const searchApi = {
  search: (q: string) =>
    apiClient.get<{ results: SearchResult[] }>('/search/', { params: { q } }),
}

// Audit
export const auditApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get<PaginatedResponse<AuditLog>>('/audit/', { params }),
}

// Tools
export const toolsApi = {
  subnetInfo: (cidr: string) =>
    apiClient.post<{
      network: string; broadcast: string; netmask: string; wildcard: string;
      prefix_length: number; num_addresses: number; num_hosts: number;
      first_host: string | null; last_host: string | null; is_private: boolean;
    }>('/tools/subnet-info/', { cidr }),
  vlsm: (cidr: string, requirements: { name: string; hosts: number }[]) =>
    apiClient.post('/tools/vlsm/', { cidr, requirements }),
}

// Export
export const exportApi = {
  excel: (projectId: number) =>
    apiClient.get(`/exports/project/${projectId}/excel/`, { responseType: 'blob' }),
  pdf: (projectId: number) =>
    apiClient.get(`/exports/project/${projectId}/pdf/`, { responseType: 'blob' }),
}
