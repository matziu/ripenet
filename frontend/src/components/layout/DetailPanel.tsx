import { useState } from 'react'
import { useUIStore } from '@/stores/ui.store'
import { useSelectionStore } from '@/stores/selection.store'
import { useTopologyStore } from '@/stores/topology.store'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { sitesApi, vlansApi, subnetsApi, hostsApi, tunnelsApi, dhcpPoolsApi } from '@/api/endpoints'
import { CopyableIP } from '@/components/shared/CopyableIP'
import { cn } from '@/lib/utils'
import { SubnetUtilBar } from '@/components/shared/SubnetUtilBar'
import { Dialog } from '@/components/ui/Dialog'
import { SiteForm } from '@/components/data/forms/SiteForm'
import { VlanForm } from '@/components/data/forms/VlanForm'
import { SubnetForm } from '@/components/data/forms/SubnetForm'
import { HostForm } from '@/components/data/forms/HostForm'
import { DHCPPoolForm } from '@/components/data/forms/DHCPPoolForm'
import { TunnelForm } from '@/components/data/forms/TunnelForm'
import { toast } from 'sonner'
import type { Host } from '@/types'
import {
  X, Pencil, Trash2, Plus,
  MapPin, Network, Server, Monitor, Cable, Layers,
} from 'lucide-react'

export function DetailPanel({ className }: { className?: string }) {
  const toggleDetailPanel = useUIStore((s) => s.toggleDetailPanel)

  // Selection from sidebar
  const selectedSiteId = useSelectionStore((s) => s.selectedSiteId)
  const selectedVlanId = useSelectionStore((s) => s.selectedVlanId)
  const selectedSubnetId = useSelectionStore((s) => s.selectedSubnetId)
  const selectedHostId = useSelectionStore((s) => s.selectedHostId)
  const selectedTunnelId = useSelectionStore((s) => s.selectedTunnelId)
  const selectedDhcpPoolId = useSelectionStore((s) => s.selectedDhcpPoolId)
  const selectedProjectId = useSelectionStore((s) => s.selectedProjectId)

  // Also listen to topology store for VLAN clicks from the topology view
  const topoVlanId = useTopologyStore((s) => s.selectedVlanId)

  // Priority: Host > DHCP Pool > Subnet > VLAN (sidebar or topology) > Tunnel > Site
  const activeView = selectedHostId
    ? 'host'
    : selectedDhcpPoolId
      ? 'dhcpPool'
      : selectedSubnetId
        ? 'subnet'
        : (selectedVlanId || topoVlanId)
          ? 'vlan'
          : selectedTunnelId
            ? 'tunnel'
            : selectedSiteId
              ? 'site'
              : null

  const effectiveVlanId = selectedVlanId || topoVlanId

  return (
    <aside className={cn("w-80 border-l border-border bg-card overflow-y-auto", className)}>
      <div className="flex items-center justify-between p-3 border-b border-border">
        <h3 className="text-sm font-semibold">Details</h3>
        <button onClick={toggleDetailPanel} className="p-1 rounded hover:bg-accent">
          <X className="h-4 w-4" />
        </button>
      </div>

      {activeView === 'site' && selectedSiteId && selectedProjectId && (
        <SiteDetail siteId={selectedSiteId} projectId={selectedProjectId} />
      )}
      {activeView === 'vlan' && effectiveVlanId && (
        <VlanDetail vlanId={effectiveVlanId} />
      )}
      {activeView === 'subnet' && selectedSubnetId && (
        <SubnetDetail subnetId={selectedSubnetId} />
      )}
      {activeView === 'tunnel' && selectedTunnelId && selectedProjectId && (
        <TunnelDetail tunnelId={selectedTunnelId} projectId={selectedProjectId} />
      )}
      {activeView === 'host' && selectedHostId && (
        <HostDetail hostId={selectedHostId} />
      )}
      {activeView === 'dhcpPool' && selectedDhcpPoolId && (
        <DHCPPoolDetail poolId={selectedDhcpPoolId} />
      )}
      {!activeView && (
        <div className="p-3 text-xs text-muted-foreground">
          Select an item in the sidebar or topology to see details.
        </div>
      )}
    </aside>
  )
}

// ── Site Detail ──────────────────────────────────────────────

function SiteDetail({ siteId, projectId }: { siteId: number; projectId: number }) {
  const queryClient = useQueryClient()
  const [editOpen, setEditOpen] = useState(false)

  const { data: site } = useQuery({
    queryKey: ['site', projectId, siteId],
    queryFn: () => sitesApi.get(projectId, siteId),
    select: (res) => res.data,
  })

  const deleteMutation = useMutation({
    mutationFn: () => sitesApi.delete(projectId, siteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sites'] })
      queryClient.invalidateQueries({ queryKey: ['topology'] })
      useSelectionStore.getState().setSelectedSite(null)
      toast.success('Site deleted')
    },
  })

  if (!site) return <DetailLoading />

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center gap-2">
        <MapPin className="h-4 w-4 text-primary shrink-0" />
        <span className="text-sm font-semibold">{site.name}</span>
      </div>

      <dl className="space-y-1.5 text-xs">
        {site.address && <DetailRow label="Address" value={site.address} />}
        {site.latitude != null && site.longitude != null && (
          <DetailRow label="Coordinates" value={`${site.latitude}, ${site.longitude}`} mono />
        )}
        <DetailRow label="VLANs" value={String(site.vlan_count)} />
        <DetailRow label="Hosts" value={String(site.host_count)} />
      </dl>

      <DetailActions
        onEdit={() => setEditOpen(true)}
        onDelete={() => {
          if (window.confirm(`Delete site "${site.name}"?`)) deleteMutation.mutate()
        }}
      />

      <Dialog open={editOpen} onOpenChange={setEditOpen} title="Edit Site">
        <SiteForm projectId={projectId} site={site} onClose={() => setEditOpen(false)} />
      </Dialog>
    </div>
  )
}

// ── VLAN Detail ──────────────────────────────────────────────

function VlanDetail({ vlanId }: { vlanId: number }) {
  const queryClient = useQueryClient()
  const [editOpen, setEditOpen] = useState(false)
  const [addSubnetOpen, setAddSubnetOpen] = useState(false)

  const { data: vlan } = useQuery({
    queryKey: ['vlan', vlanId],
    queryFn: () => vlansApi.get(vlanId),
    select: (res) => res.data,
  })

  const { data: hostsData } = useQuery({
    queryKey: ['hosts', { vlan: vlanId }],
    queryFn: () => hostsApi.list({ vlan: String(vlanId) }),
    select: (res) => res.data.results,
  })

  const deleteMutation = useMutation({
    mutationFn: () => vlansApi.delete(vlanId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vlans'] })
      queryClient.invalidateQueries({ queryKey: ['topology'] })
      useSelectionStore.getState().setSelectedVlan(null)
      toast.success('VLAN deleted')
    },
  })

  const hosts = hostsData ?? []

  if (!vlan) return <DetailLoading />

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center gap-2">
        <Network className="h-4 w-4 text-primary shrink-0" />
        <span className="text-sm font-semibold">VLAN {vlan.vlan_id} - {vlan.name}</span>
      </div>

      {vlan.purpose && (
        <p className="text-xs text-muted-foreground">{vlan.purpose}</p>
      )}

      <dl className="space-y-1.5 text-xs">
        <DetailRow label="Subnets" value={String(vlan.subnet_count)} />
        <DetailRow label="Hosts" value={String(vlan.host_count)} />
      </dl>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold uppercase text-muted-foreground">
            Hosts ({hosts.length})
          </h4>
          <button
            onClick={() => setAddSubnetOpen(true)}
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            <Plus className="h-3 w-3" /> Subnet
          </button>
        </div>
        <HostList hosts={hosts} />
      </div>

      <DetailActions
        onEdit={() => setEditOpen(true)}
        onDelete={() => {
          if (window.confirm(`Delete VLAN ${vlan.vlan_id}?`)) deleteMutation.mutate()
        }}
      />

      <Dialog open={editOpen} onOpenChange={setEditOpen} title="Edit VLAN">
        <VlanForm siteId={vlan.site} vlan={vlan} onClose={() => setEditOpen(false)} />
      </Dialog>

      <Dialog open={addSubnetOpen} onOpenChange={setAddSubnetOpen} title="Add Subnet">
        <SubnetForm vlanId={vlanId} onClose={() => setAddSubnetOpen(false)} />
      </Dialog>
    </div>
  )
}

// ── Subnet Detail ────────────────────────────────────────────

function SubnetDetail({ subnetId }: { subnetId: number }) {
  const queryClient = useQueryClient()
  const [editOpen, setEditOpen] = useState(false)
  const [addHostOpen, setAddHostOpen] = useState(false)
  const [addPoolOpen, setAddPoolOpen] = useState(false)

  const { data: subnet } = useQuery({
    queryKey: ['subnet', subnetId],
    queryFn: () => subnetsApi.get(subnetId),
    select: (res) => res.data,
  })

  const { data: hostsData } = useQuery({
    queryKey: ['hosts', { subnet: subnetId }],
    queryFn: () => hostsApi.list({ subnet: String(subnetId) }),
    select: (res) => res.data.results,
  })

  const { data: dhcpPoolsData } = useQuery({
    queryKey: ['dhcp-pools', { subnet: subnetId }],
    queryFn: () => dhcpPoolsApi.list({ subnet: String(subnetId) }),
    select: (res) => res.data.results,
  })

  const deleteMutation = useMutation({
    mutationFn: () => subnetsApi.delete(subnetId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subnets'] })
      queryClient.invalidateQueries({ queryKey: ['topology'] })
      useSelectionStore.getState().setSelectedSubnet(null)
      toast.success('Subnet deleted')
    },
  })

  const hosts = hostsData ?? []
  const dhcpPools = dhcpPoolsData ?? []

  if (!subnet) return <DetailLoading />

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center gap-2">
        <Server className="h-4 w-4 text-primary shrink-0" />
        <span className="text-sm font-semibold font-mono">{subnet.network}</span>
      </div>

      <SubnetUtilBar network={subnet.network} hostCount={subnet.static_host_count} dhcpPoolSize={subnet.dhcp_pool_total_size} variant="full" />

      <dl className="space-y-1.5 text-xs">
        {subnet.gateway && <DetailRow label="Gateway" value={subnet.gateway} mono />}
        {subnet.description && <DetailRow label="Description" value={subnet.description} />}
      </dl>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold uppercase text-muted-foreground">
            Hosts ({hosts.length})
          </h4>
          <button
            onClick={() => setAddHostOpen(true)}
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            <Plus className="h-3 w-3" /> Host
          </button>
        </div>
        <HostList hosts={hosts} />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold uppercase text-muted-foreground">
            DHCP Pools ({dhcpPools.length})
          </h4>
          <button
            onClick={() => setAddPoolOpen(true)}
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            <Plus className="h-3 w-3" /> Pool
          </button>
        </div>
        <div className="space-y-1">
          {dhcpPools.map((pool) => (
            <div
              key={pool.id}
              onClick={() => useSelectionStore.getState().setSelectedDhcpPool(pool.id)}
              className="flex w-full items-center justify-between rounded-md border border-border p-2 text-xs hover:bg-accent/50 transition-colors cursor-pointer"
            >
              <span className="font-mono">{pool.start_ip.split('/')[0]} – {pool.end_ip.split('/')[0]}</span>
              <span className="text-[10px] text-muted-foreground">{pool.lease_count} leases</span>
            </div>
          ))}
          {dhcpPools.length === 0 && (
            <p className="text-xs text-muted-foreground">No DHCP pools</p>
          )}
        </div>
      </div>

      <DetailActions
        onEdit={() => setEditOpen(true)}
        onDelete={() => {
          if (window.confirm(`Delete subnet ${subnet.network}?`)) deleteMutation.mutate()
        }}
      />

      <Dialog open={editOpen} onOpenChange={setEditOpen} title="Edit Subnet">
        <SubnetForm
          vlanId={subnet.vlan ?? undefined}
          siteId={subnet.site ?? undefined}
          projectId={subnet.project}
          subnet={subnet}
          onClose={() => setEditOpen(false)}
        />
      </Dialog>

      <Dialog open={addHostOpen} onOpenChange={setAddHostOpen} title="Add Host">
        <HostForm subnetId={subnetId} onClose={() => setAddHostOpen(false)} />
      </Dialog>

      <Dialog open={addPoolOpen} onOpenChange={setAddPoolOpen} title="Add DHCP Pool">
        <DHCPPoolForm subnetId={subnetId} onClose={() => setAddPoolOpen(false)} />
      </Dialog>
    </div>
  )
}

// ── Tunnel Detail ────────────────────────────────────────────

function TunnelDetail({ tunnelId, projectId }: { tunnelId: number; projectId: number }) {
  const queryClient = useQueryClient()
  const [editOpen, setEditOpen] = useState(false)

  const { data: tunnel } = useQuery({
    queryKey: ['tunnel', tunnelId],
    queryFn: () => tunnelsApi.get(tunnelId),
    select: (res) => res.data,
  })

  const deleteMutation = useMutation({
    mutationFn: () => tunnelsApi.delete(tunnelId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tunnels'] })
      queryClient.invalidateQueries({ queryKey: ['topology'] })
      useSelectionStore.getState().setSelectedTunnel(null)
      toast.success('Tunnel deleted')
    },
  })

  if (!tunnel) return <DetailLoading />

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center gap-2">
        <Cable className="h-4 w-4 text-primary shrink-0" />
        <span className="text-sm font-semibold">{tunnel.name}</span>
      </div>

      <div className="flex items-center gap-2">
        <span className={cn(
          'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium',
          tunnel.enabled
            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
            : 'bg-muted text-muted-foreground'
        )}>
          {tunnel.enabled ? 'Enabled' : 'Disabled'}
        </span>
        <span className="text-xs uppercase text-muted-foreground">{tunnel.tunnel_type}</span>
      </div>

      <dl className="space-y-1.5 text-xs">
        <DetailRow label="Subnet" value={tunnel.tunnel_subnet} mono />
        <DetailRow label="Site A" value={tunnel.site_a_name} />
        <DetailRow label="IP A" value={tunnel.ip_a} mono />
        {tunnel.site_b_name ? (
          <DetailRow label="Site B" value={tunnel.site_b_project_name ? `${tunnel.site_b_project_name} / ${tunnel.site_b_name}` : tunnel.site_b_name} />
        ) : (
          <DetailRow label="External" value={tunnel.external_endpoint} />
        )}
        <DetailRow label="IP B" value={tunnel.ip_b} mono />
        {tunnel.description && <DetailRow label="Description" value={tunnel.description} />}
      </dl>

      <DetailActions
        onEdit={() => setEditOpen(true)}
        onDelete={() => {
          if (window.confirm(`Delete tunnel "${tunnel.name}"?`)) deleteMutation.mutate()
        }}
      />

      <Dialog open={editOpen} onOpenChange={setEditOpen} title="Edit Tunnel">
        <TunnelForm projectId={projectId} tunnel={tunnel} onClose={() => setEditOpen(false)} />
      </Dialog>
    </div>
  )
}

// ── Host Detail ──────────────────────────────────────────────

function HostDetail({ hostId }: { hostId: number }) {
  const queryClient = useQueryClient()
  const [editOpen, setEditOpen] = useState(false)

  const { data: host } = useQuery({
    queryKey: ['host', hostId],
    queryFn: () => hostsApi.get(hostId),
    select: (res) => res.data,
  })

  const deleteMutation = useMutation({
    mutationFn: () => hostsApi.delete(hostId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hosts'] })
      queryClient.invalidateQueries({ queryKey: ['topology'] })
      useSelectionStore.getState().setSelectedHost(null)
      toast.success('Host deleted')
    },
  })

  if (!host) return <DetailLoading />

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center gap-2">
        <Monitor className="h-4 w-4 text-primary shrink-0" />
        <div className="min-w-0">
          <CopyableIP ip={host.ip_address} />
          {host.hostname && (
            <p className="text-xs text-muted-foreground truncate">{host.hostname}</p>
          )}
        </div>
      </div>

      <dl className="space-y-1.5 text-xs">
        {host.mac_address && <DetailRow label="MAC" value={host.mac_address} mono />}
        <DetailRow label="Device Type" value={host.device_type} />
        {host.description && <DetailRow label="Description" value={host.description} />}
      </dl>

      <DetailActions
        onEdit={() => setEditOpen(true)}
        onDelete={() => {
          if (window.confirm(`Delete host ${host.ip_address}?`)) deleteMutation.mutate()
        }}
      />

      <Dialog open={editOpen} onOpenChange={setEditOpen} title="Edit Host">
        <HostForm subnetId={host.subnet} host={host} onClose={() => setEditOpen(false)} />
      </Dialog>
    </div>
  )
}

// ── DHCP Pool Detail ──────────────────────────────────────────

function DHCPPoolDetail({ poolId }: { poolId: number }) {
  const queryClient = useQueryClient()
  const setSelectedSubnet = useSelectionStore((s) => s.setSelectedSubnet)
  const [editOpen, setEditOpen] = useState(false)
  const [addHostOpen, setAddHostOpen] = useState(false)

  const { data: pool } = useQuery({
    queryKey: ['dhcp-pool', poolId],
    queryFn: () => dhcpPoolsApi.get(poolId),
    select: (res) => res.data,
  })

  const { data: subnet } = useQuery({
    queryKey: ['subnet', pool?.subnet],
    queryFn: () => subnetsApi.get(pool!.subnet),
    select: (res) => res.data,
    enabled: !!pool,
  })

  const { data: hostsData } = useQuery({
    queryKey: ['hosts', { dhcp_pool: poolId }],
    queryFn: () => hostsApi.list({ dhcp_pool: String(poolId) }),
    select: (res) => res.data.results,
  })

  const deleteMutation = useMutation({
    mutationFn: () => dhcpPoolsApi.delete(poolId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dhcp-pools'] })
      queryClient.invalidateQueries({ queryKey: ['topology'] })
      useSelectionStore.getState().setSelectedDhcpPool(null)
      toast.success('DHCP Pool deleted')
    },
    onError: (err: unknown) => {
      const message = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Failed to delete'
      toast.error(message)
    },
  })

  const hosts = hostsData ?? []

  if (!pool) return <DetailLoading />

  const startIp = pool.start_ip.split('/')[0]
  const endIp = pool.end_ip.split('/')[0]

  // Calculate pool size
  const ipToInt = (ip: string) => {
    const parts = ip.split('.')
    return parts.reduce((acc, p) => (acc << 8) + parseInt(p, 10), 0) >>> 0
  }
  const poolSize = ipToInt(endIp) - ipToInt(startIp) + 1

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center gap-2">
        <Layers className="h-4 w-4 text-primary shrink-0" />
        <div className="min-w-0">
          <span className="text-sm font-semibold font-mono block">
            {startIp} – {endIp}
          </span>
          {subnet && (
            <button
              onClick={() => setSelectedSubnet(pool.subnet)}
              className="text-[10px] text-muted-foreground hover:text-primary transition-colors"
            >
              ← {subnet.network}
            </button>
          )}
        </div>
      </div>

      <dl className="space-y-1.5 text-xs">
        <DetailRow label="Pool Size" value={`${poolSize} addresses`} />
        <DetailRow label="Leases" value={`${hosts.length} / ${poolSize}`} />
        {pool.description && <DetailRow label="Description" value={pool.description} />}
      </dl>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-xs font-semibold uppercase text-muted-foreground">
            Leases ({hosts.length})
          </h4>
          <button
            onClick={() => setAddHostOpen(true)}
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            <Plus className="h-3 w-3" /> Lease
          </button>
        </div>
        <HostList hosts={hosts} />
      </div>

      <DetailActions
        onEdit={() => setEditOpen(true)}
        onDelete={() => {
          if (window.confirm('Delete this DHCP pool?')) deleteMutation.mutate()
        }}
      />

      <Dialog open={editOpen} onOpenChange={setEditOpen} title="Edit DHCP Pool">
        <DHCPPoolForm subnetId={pool.subnet} pool={pool} onClose={() => setEditOpen(false)} />
      </Dialog>

      <Dialog open={addHostOpen} onOpenChange={setAddHostOpen} title="Add DHCP Lease">
        <HostForm
          subnetId={pool.subnet}
          defaultIpType="dhcp_lease"
          defaultDhcpPoolId={pool.id}
          onClose={() => setAddHostOpen(false)}
        />
      </Dialog>
    </div>
  )
}

// ── Shared helpers ───────────────────────────────────────────

function DetailLoading() {
  return <div className="p-3 text-xs text-muted-foreground">Loading...</div>
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={mono ? 'font-mono' : ''}>{value}</dd>
    </div>
  )
}

function DetailActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex gap-2 pt-1 border-t border-border">
      <button
        onClick={onEdit}
        className="flex items-center gap-1 rounded-md border border-border px-3 py-1 text-xs hover:bg-accent transition-colors"
      >
        <Pencil className="h-3 w-3" /> Edit
      </button>
      <button
        onClick={onDelete}
        className="flex items-center gap-1 rounded-md border border-border px-3 py-1 text-xs text-red-500 hover:bg-red-500/10 transition-colors"
      >
        <Trash2 className="h-3 w-3" /> Delete
      </button>
    </div>
  )
}

function HostList({ hosts }: { hosts: Host[] }) {
  const setSelectedHost = useSelectionStore((s) => s.setSelectedHost)

  return (
    <div className="space-y-1">
      {hosts.map((host) => (
        <div
          key={host.id}
          onClick={() => setSelectedHost(host.id)}
          className="flex w-full items-center justify-between rounded-md border border-border p-2 text-xs hover:bg-accent/50 transition-colors cursor-pointer"
        >
          <div className="min-w-0">
            <CopyableIP ip={host.ip_address} />
            {host.hostname && (
              <p className="text-muted-foreground truncate mt-0.5">{host.hostname}</p>
            )}
          </div>
          <span className="text-[10px] text-muted-foreground">{host.device_type}</span>
        </div>
      ))}
      {hosts.length === 0 && (
        <p className="text-xs text-muted-foreground">No hosts</p>
      )}
    </div>
  )
}
