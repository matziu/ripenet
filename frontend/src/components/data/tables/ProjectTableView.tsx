import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { sitesApi, vlansApi, subnetsApi, hostsApi, tunnelsApi } from '@/api/endpoints'
import { CopyableIP } from '@/components/shared/CopyableIP'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { cn } from '@/lib/utils'

interface ProjectTableViewProps {
  projectId: number
}

export function ProjectTableView({ projectId }: ProjectTableViewProps) {
  const [activeTab, setActiveTab] = useState<'sites' | 'vlans' | 'subnets' | 'hosts' | 'tunnels'>('hosts')

  const tabs = [
    { id: 'sites' as const, label: 'Sites' },
    { id: 'vlans' as const, label: 'VLANs' },
    { id: 'subnets' as const, label: 'Subnets' },
    { id: 'hosts' as const, label: 'Hosts' },
    { id: 'tunnels' as const, label: 'Tunnels' },
  ]

  return (
    <div className="h-full flex flex-col">
      <div className="flex border-b border-border bg-card/50">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
              activeTab === tab.id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto p-4">
        {activeTab === 'sites' && <SitesTable projectId={projectId} />}
        {activeTab === 'vlans' && <VlansTable projectId={projectId} />}
        {activeTab === 'subnets' && <SubnetsTable projectId={projectId} />}
        {activeTab === 'hosts' && <HostsTable projectId={projectId} />}
        {activeTab === 'tunnels' && <TunnelsTable projectId={projectId} />}
      </div>
    </div>
  )
}

function SitesTable({ projectId }: { projectId: number }) {
  const { data: sites } = useQuery({
    queryKey: ['sites', projectId],
    queryFn: () => sitesApi.list(projectId),
    select: (res) => res.data.results,
  })

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border text-left">
          <th className="px-3 py-2 font-medium">Name</th>
          <th className="px-3 py-2 font-medium">Address</th>
          <th className="px-3 py-2 font-medium">Coordinates</th>
          <th className="px-3 py-2 font-medium">VLANs</th>
          <th className="px-3 py-2 font-medium">Hosts</th>
        </tr>
      </thead>
      <tbody>
        {sites?.map((site) => (
          <tr key={site.id} className="border-b border-border hover:bg-accent/30">
            <td className="px-3 py-2 font-medium">{site.name}</td>
            <td className="px-3 py-2 text-muted-foreground">{site.address || '-'}</td>
            <td className="px-3 py-2 text-xs font-mono text-muted-foreground">
              {site.latitude && site.longitude ? `${site.latitude}, ${site.longitude}` : '-'}
            </td>
            <td className="px-3 py-2">{site.vlan_count}</td>
            <td className="px-3 py-2">{site.host_count}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function VlansTable({ projectId }: { projectId: number }) {
  const { data: vlans } = useQuery({
    queryKey: ['vlans', { project: projectId }],
    queryFn: () => vlansApi.list({ project: String(projectId) }),
    select: (res) => res.data.results,
  })

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border text-left">
          <th className="px-3 py-2 font-medium">VLAN ID</th>
          <th className="px-3 py-2 font-medium">Name</th>
          <th className="px-3 py-2 font-medium">Purpose</th>
          <th className="px-3 py-2 font-medium">Subnets</th>
          <th className="px-3 py-2 font-medium">Hosts</th>
        </tr>
      </thead>
      <tbody>
        {vlans?.map((vlan) => (
          <tr key={vlan.id} className="border-b border-border hover:bg-accent/30">
            <td className="px-3 py-2 font-mono">{vlan.vlan_id}</td>
            <td className="px-3 py-2 font-medium">{vlan.name}</td>
            <td className="px-3 py-2 text-muted-foreground">{vlan.purpose || '-'}</td>
            <td className="px-3 py-2">{vlan.subnet_count}</td>
            <td className="px-3 py-2">{vlan.host_count}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function SubnetsTable({ projectId }: { projectId: number }) {
  const { data: subnets } = useQuery({
    queryKey: ['subnets', { project: projectId }],
    queryFn: () => subnetsApi.list({ project: String(projectId) }),
    select: (res) => res.data.results,
  })

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border text-left">
          <th className="px-3 py-2 font-medium">Network</th>
          <th className="px-3 py-2 font-medium">Gateway</th>
          <th className="px-3 py-2 font-medium">Description</th>
          <th className="px-3 py-2 font-medium">Hosts</th>
        </tr>
      </thead>
      <tbody>
        {subnets?.map((subnet) => (
          <tr key={subnet.id} className="border-b border-border hover:bg-accent/30">
            <td className="px-3 py-2 font-mono">{subnet.network}</td>
            <td className="px-3 py-2 font-mono text-muted-foreground">{subnet.gateway || '-'}</td>
            <td className="px-3 py-2 text-muted-foreground">{subnet.description || '-'}</td>
            <td className="px-3 py-2">{subnet.host_count}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function HostsTable({ projectId }: { projectId: number }) {
  const { data: hosts } = useQuery({
    queryKey: ['hosts', { project: projectId }],
    queryFn: () => hostsApi.list({ project: String(projectId) }),
    select: (res) => res.data.results,
  })

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border text-left">
          <th className="px-3 py-2 font-medium">IP Address</th>
          <th className="px-3 py-2 font-medium">Hostname</th>
          <th className="px-3 py-2 font-medium">MAC</th>
          <th className="px-3 py-2 font-medium">Status</th>
          <th className="px-3 py-2 font-medium">Device</th>
        </tr>
      </thead>
      <tbody>
        {hosts?.map((host) => (
          <tr key={host.id} className="border-b border-border hover:bg-accent/30">
            <td className="px-3 py-2">
              <CopyableIP ip={host.ip_address} />
            </td>
            <td className="px-3 py-2">{host.hostname || '-'}</td>
            <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{host.mac_address || '-'}</td>
            <td className="px-3 py-2">
              <StatusBadge status={host.status} />
            </td>
            <td className="px-3 py-2 text-muted-foreground">{host.device_type}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function TunnelsTable({ projectId }: { projectId: number }) {
  const { data: tunnels } = useQuery({
    queryKey: ['tunnels', { project: projectId }],
    queryFn: () => tunnelsApi.list({ project: String(projectId) }),
    select: (res) => res.data.results,
  })

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border text-left">
          <th className="px-3 py-2 font-medium">Name</th>
          <th className="px-3 py-2 font-medium">Type</th>
          <th className="px-3 py-2 font-medium">Subnet</th>
          <th className="px-3 py-2 font-medium">Site A</th>
          <th className="px-3 py-2 font-medium">IP A</th>
          <th className="px-3 py-2 font-medium">Site B</th>
          <th className="px-3 py-2 font-medium">IP B</th>
          <th className="px-3 py-2 font-medium">Status</th>
        </tr>
      </thead>
      <tbody>
        {tunnels?.map((tunnel) => (
          <tr key={tunnel.id} className="border-b border-border hover:bg-accent/30">
            <td className="px-3 py-2 font-medium">{tunnel.name}</td>
            <td className="px-3 py-2 uppercase text-xs">{tunnel.tunnel_type}</td>
            <td className="px-3 py-2 font-mono text-xs">{tunnel.tunnel_subnet}</td>
            <td className="px-3 py-2">{tunnel.site_a_name}</td>
            <td className="px-3 py-2"><CopyableIP ip={tunnel.ip_a} /></td>
            <td className="px-3 py-2">{tunnel.site_b_name}</td>
            <td className="px-3 py-2"><CopyableIP ip={tunnel.ip_b} /></td>
            <td className="px-3 py-2"><StatusBadge status={tunnel.status} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
