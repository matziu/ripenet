import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { sitesApi, vlansApi, subnetsApi, hostsApi, tunnelsApi } from '@/api/endpoints'
import { CopyableIP } from '@/components/shared/CopyableIP'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Dialog } from '@/components/ui/Dialog'
import { SiteForm } from '@/components/data/forms/SiteForm'
import { VlanForm } from '@/components/data/forms/VlanForm'
import { SubnetForm } from '@/components/data/forms/SubnetForm'
import { HostForm } from '@/components/data/forms/HostForm'
import { TunnelForm } from '@/components/data/forms/TunnelForm'
import { cn } from '@/lib/utils'
import { Plus, Pencil, Trash2, Building2, Network } from 'lucide-react'
import type { TableTab } from '@/pages/ProjectPage'
import type { Site, VLAN, Subnet, Host, Tunnel } from '@/types'

interface ProjectTableViewProps {
  projectId: number
  activeTab: TableTab
}

export function ProjectTableView({ projectId, activeTab }: ProjectTableViewProps) {
  const navigate = useNavigate()
  const { projectId: pid } = useParams()

  const tabs: { id: TableTab; label: string }[] = [
    { id: 'sites', label: 'Sites' },
    { id: 'vlans', label: 'VLANs' },
    { id: 'subnets', label: 'Subnets' },
    { id: 'hosts', label: 'Hosts' },
    { id: 'tunnels', label: 'Tunnels' },
  ]

  return (
    <div className="h-full flex flex-col">
      <div className="flex border-b border-border bg-card/50">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => navigate(`/projects/${pid}/table/${tab.id}`)}
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

// ─── Sites ────────────────────────────────────────────────────

function SitesTable({ projectId }: { projectId: number }) {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editSite, setEditSite] = useState<Site | undefined>()

  const { data: sites } = useQuery({
    queryKey: ['sites', projectId],
    queryFn: () => sitesApi.list(projectId),
    select: (res) => res.data.results,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => sitesApi.delete(projectId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sites', projectId] })
      queryClient.invalidateQueries({ queryKey: ['topology'] })
    },
  })

  const openAdd = () => { setEditSite(undefined); setDialogOpen(true) }
  const openEdit = (site: Site) => { setEditSite(site); setDialogOpen(true) }
  const handleDelete = (site: Site) => {
    if (window.confirm(`Delete site "${site.name}"?`)) deleteMutation.mutate(site.id)
  }

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-muted-foreground">{sites?.length ?? 0} sites</h3>
        <button onClick={openAdd} className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90">
          <Plus className="h-3.5 w-3.5" /> Add Site
        </button>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="px-3 py-2 font-medium">Name</th>
            <th className="px-3 py-2 font-medium">Address</th>
            <th className="px-3 py-2 font-medium">Coordinates</th>
            <th className="px-3 py-2 font-medium">VLANs</th>
            <th className="px-3 py-2 font-medium">Hosts</th>
            <th className="px-3 py-2 font-medium w-20"></th>
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
              <td className="px-3 py-2">
                <div className="flex gap-1">
                  <button onClick={() => openEdit(site)} className="p-1 rounded hover:bg-accent" title="Edit">
                    <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                  <button onClick={() => handleDelete(site)} className="p-1 rounded hover:bg-destructive/20" title="Delete">
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen} title={editSite ? 'Edit Site' : 'Add Site'}>
        <SiteForm projectId={projectId} site={editSite} onClose={() => setDialogOpen(false)} />
      </Dialog>
    </>
  )
}

// ─── VLANs (grouped by Site) ──────────────────────────────────

function VlansTable({ projectId }: { projectId: number }) {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editVlan, setEditVlan] = useState<VLAN | undefined>()
  const [addForSiteId, setAddForSiteId] = useState<number | undefined>()

  const { data: vlans } = useQuery({
    queryKey: ['vlans', { project: projectId }],
    queryFn: () => vlansApi.list({ project: String(projectId) }),
    select: (res) => res.data.results,
  })

  const { data: sites } = useQuery({
    queryKey: ['sites', projectId],
    queryFn: () => sitesApi.list(projectId),
    select: (res) => res.data.results,
  })

  const grouped = useMemo(() => {
    if (!vlans || !sites) return []
    const siteMap = new Map(sites.map((s) => [s.id, s]))
    const groups = new Map<number, { site: Site; vlans: VLAN[] }>()
    for (const vlan of vlans) {
      const site = siteMap.get(vlan.site)
      if (!site) continue
      const group = groups.get(site.id)
      if (group) group.vlans.push(vlan)
      else groups.set(site.id, { site, vlans: [vlan] })
    }
    return Array.from(groups.values())
  }, [vlans, sites])

  const deleteMutation = useMutation({
    mutationFn: (id: number) => vlansApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vlans'] })
      queryClient.invalidateQueries({ queryKey: ['topology'] })
    },
  })

  const openAdd = (siteId?: number) => { setEditVlan(undefined); setAddForSiteId(siteId); setDialogOpen(true) }
  const openEdit = (vlan: VLAN) => { setEditVlan(vlan); setAddForSiteId(vlan.site); setDialogOpen(true) }
  const handleDelete = (vlan: VLAN) => {
    if (window.confirm(`Delete VLAN "${vlan.name}" (${vlan.vlan_id})?`)) deleteMutation.mutate(vlan.id)
  }

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-muted-foreground">{vlans?.length ?? 0} VLANs across {grouped.length} sites</h3>
        <button onClick={() => openAdd()} className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90">
          <Plus className="h-3.5 w-3.5" /> Add VLAN
        </button>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="px-3 py-2 font-medium">VLAN ID</th>
            <th className="px-3 py-2 font-medium">Name</th>
            <th className="px-3 py-2 font-medium">Purpose</th>
            <th className="px-3 py-2 font-medium">Subnets</th>
            <th className="px-3 py-2 font-medium">Hosts</th>
            <th className="px-3 py-2 font-medium w-20"></th>
          </tr>
        </thead>
        <tbody>
          {grouped.map(({ site, vlans: siteVlans }) => (
            <GroupRows key={site.id}>
              <tr className="bg-muted/40">
                <td colSpan={5} className="px-3 py-1.5">
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                    <Building2 className="h-3 w-3" />
                    {site.name}
                    <span className="font-normal">({siteVlans.length})</span>
                  </span>
                </td>
                <td className="px-3 py-1.5 text-right">
                  <button onClick={() => openAdd(site.id)} className="p-1 rounded hover:bg-accent" title={`Add VLAN to ${site.name}`}>
                    <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </td>
              </tr>
              {siteVlans.map((vlan) => (
                <tr key={vlan.id} className="border-b border-border hover:bg-accent/30">
                  <td className="px-3 py-2 pl-7 font-mono">{vlan.vlan_id}</td>
                  <td className="px-3 py-2 font-medium">{vlan.name}</td>
                  <td className="px-3 py-2 text-muted-foreground">{vlan.purpose || '-'}</td>
                  <td className="px-3 py-2">{vlan.subnet_count}</td>
                  <td className="px-3 py-2">{vlan.host_count}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(vlan)} className="p-1 rounded hover:bg-accent" title="Edit">
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                      <button onClick={() => handleDelete(vlan)} className="p-1 rounded hover:bg-destructive/20" title="Delete">
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </GroupRows>
          ))}
        </tbody>
      </table>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen} title={editVlan ? 'Edit VLAN' : 'Add VLAN'}>
        <VlanForm
          siteId={addForSiteId}
          projectId={projectId}
          vlan={editVlan}
          onClose={() => setDialogOpen(false)}
        />
      </Dialog>
    </>
  )
}

// ─── Subnets (grouped by VLAN) ────────────────────────────────

function SubnetsTable({ projectId }: { projectId: number }) {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editSubnet, setEditSubnet] = useState<Subnet | undefined>()
  const [addForVlanId, setAddForVlanId] = useState<number | undefined>()

  const { data: subnets } = useQuery({
    queryKey: ['subnets', { project: projectId }],
    queryFn: () => subnetsApi.list({ project: String(projectId) }),
    select: (res) => res.data.results,
  })

  const { data: vlans } = useQuery({
    queryKey: ['vlans', { project: projectId }],
    queryFn: () => vlansApi.list({ project: String(projectId) }),
    select: (res) => res.data.results,
  })

  const grouped = useMemo(() => {
    if (!subnets || !vlans) return []
    const vlanMap = new Map(vlans.map((v) => [v.id, v]))
    const groups = new Map<number, { vlan: VLAN; subnets: Subnet[] }>()
    for (const subnet of subnets) {
      const vlan = vlanMap.get(subnet.vlan)
      if (!vlan) continue
      const group = groups.get(vlan.id)
      if (group) group.subnets.push(subnet)
      else groups.set(vlan.id, { vlan, subnets: [subnet] })
    }
    return Array.from(groups.values())
  }, [subnets, vlans])

  const deleteMutation = useMutation({
    mutationFn: (id: number) => subnetsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subnets'] })
      queryClient.invalidateQueries({ queryKey: ['topology'] })
    },
  })

  const openAdd = (vlanId?: number) => { setEditSubnet(undefined); setAddForVlanId(vlanId); setDialogOpen(true) }
  const openEdit = (subnet: Subnet) => { setEditSubnet(subnet); setAddForVlanId(subnet.vlan); setDialogOpen(true) }
  const handleDelete = (subnet: Subnet) => {
    if (window.confirm(`Delete subnet "${subnet.network}"?`)) deleteMutation.mutate(subnet.id)
  }

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-muted-foreground">{subnets?.length ?? 0} subnets across {grouped.length} VLANs</h3>
        <button onClick={() => openAdd()} className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90">
          <Plus className="h-3.5 w-3.5" /> Add Subnet
        </button>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="px-3 py-2 font-medium">Network</th>
            <th className="px-3 py-2 font-medium">Gateway</th>
            <th className="px-3 py-2 font-medium">Description</th>
            <th className="px-3 py-2 font-medium">Hosts</th>
            <th className="px-3 py-2 font-medium w-20"></th>
          </tr>
        </thead>
        <tbody>
          {grouped.map(({ vlan, subnets: vlanSubnets }) => (
            <GroupRows key={vlan.id}>
              <tr className="bg-muted/40">
                <td colSpan={4} className="px-3 py-1.5">
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                    <Network className="h-3 w-3" />
                    VLAN {vlan.vlan_id} &mdash; {vlan.name}
                    <span className="font-normal">({vlanSubnets.length})</span>
                  </span>
                </td>
                <td className="px-3 py-1.5 text-right">
                  <button onClick={() => openAdd(vlan.id)} className="p-1 rounded hover:bg-accent" title={`Add subnet to VLAN ${vlan.vlan_id}`}>
                    <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </td>
              </tr>
              {vlanSubnets.map((subnet) => (
                <tr key={subnet.id} className="border-b border-border hover:bg-accent/30">
                  <td className="px-3 py-2 pl-7 font-mono">{subnet.network}</td>
                  <td className="px-3 py-2 font-mono text-muted-foreground">{subnet.gateway || '-'}</td>
                  <td className="px-3 py-2 text-muted-foreground">{subnet.description || '-'}</td>
                  <td className="px-3 py-2">{subnet.host_count}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(subnet)} className="p-1 rounded hover:bg-accent" title="Edit">
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                      <button onClick={() => handleDelete(subnet)} className="p-1 rounded hover:bg-destructive/20" title="Delete">
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </GroupRows>
          ))}
        </tbody>
      </table>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen} title={editSubnet ? 'Edit Subnet' : 'Add Subnet'}>
        <SubnetForm
          vlanId={addForVlanId}
          projectId={projectId}
          subnet={editSubnet}
          onClose={() => setDialogOpen(false)}
        />
      </Dialog>
    </>
  )
}

// ─── Hosts (grouped by Subnet) ────────────────────────────────

function HostsTable({ projectId }: { projectId: number }) {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editHost, setEditHost] = useState<Host | undefined>()
  const [addForSubnetId, setAddForSubnetId] = useState<number | undefined>()

  const { data: hosts } = useQuery({
    queryKey: ['hosts', { project: projectId }],
    queryFn: () => hostsApi.list({ project: String(projectId) }),
    select: (res) => res.data.results,
  })

  const { data: subnets } = useQuery({
    queryKey: ['subnets', { project: projectId }],
    queryFn: () => subnetsApi.list({ project: String(projectId) }),
    select: (res) => res.data.results,
  })

  const grouped = useMemo(() => {
    if (!hosts || !subnets) return []
    const subnetMap = new Map(subnets.map((s) => [s.id, s]))
    const groups = new Map<number, { subnet: Subnet; hosts: Host[] }>()
    for (const host of hosts) {
      const subnet = subnetMap.get(host.subnet)
      if (!subnet) continue
      const group = groups.get(subnet.id)
      if (group) group.hosts.push(host)
      else groups.set(subnet.id, { subnet, hosts: [host] })
    }
    return Array.from(groups.values())
  }, [hosts, subnets])

  const deleteMutation = useMutation({
    mutationFn: (id: number) => hostsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hosts'] })
      queryClient.invalidateQueries({ queryKey: ['topology'] })
    },
  })

  const openAdd = (subnetId?: number) => { setEditHost(undefined); setAddForSubnetId(subnetId); setDialogOpen(true) }
  const openEdit = (host: Host) => { setEditHost(host); setAddForSubnetId(host.subnet); setDialogOpen(true) }
  const handleDelete = (host: Host) => {
    if (window.confirm(`Delete host "${host.hostname || host.ip_address}"?`)) deleteMutation.mutate(host.id)
  }

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-muted-foreground">{hosts?.length ?? 0} hosts across {grouped.length} subnets</h3>
        <button onClick={() => openAdd()} className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90">
          <Plus className="h-3.5 w-3.5" /> Add Host
        </button>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="px-3 py-2 font-medium">IP Address</th>
            <th className="px-3 py-2 font-medium">Hostname</th>
            <th className="px-3 py-2 font-medium">MAC</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Device</th>
            <th className="px-3 py-2 font-medium w-20"></th>
          </tr>
        </thead>
        <tbody>
          {grouped.map(({ subnet, hosts: subnetHosts }) => (
            <GroupRows key={subnet.id}>
              <tr className="bg-muted/40">
                <td colSpan={5} className="px-3 py-1.5">
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                    <Network className="h-3 w-3" />
                    {subnet.network}
                    {subnet.gateway && <span className="font-normal">gw {subnet.gateway}</span>}
                    <span className="font-normal">({subnetHosts.length})</span>
                  </span>
                </td>
                <td className="px-3 py-1.5 text-right">
                  <button onClick={() => openAdd(subnet.id)} className="p-1 rounded hover:bg-accent" title={`Add host to ${subnet.network}`}>
                    <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </td>
              </tr>
              {subnetHosts.map((host) => (
                <tr key={host.id} className="border-b border-border hover:bg-accent/30">
                  <td className="px-3 py-2 pl-7">
                    <CopyableIP ip={host.ip_address} />
                  </td>
                  <td className="px-3 py-2">{host.hostname || '-'}</td>
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{host.mac_address || '-'}</td>
                  <td className="px-3 py-2">
                    <StatusBadge status={host.status} />
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{host.device_type}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(host)} className="p-1 rounded hover:bg-accent" title="Edit">
                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                      <button onClick={() => handleDelete(host)} className="p-1 rounded hover:bg-destructive/20" title="Delete">
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </GroupRows>
          ))}
        </tbody>
      </table>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen} title={editHost ? 'Edit Host' : 'Add Host'}>
        <HostForm
          subnetId={addForSubnetId}
          projectId={projectId}
          host={editHost}
          onClose={() => setDialogOpen(false)}
        />
      </Dialog>
    </>
  )
}

// ─── Tunnels ──────────────────────────────────────────────────

function TunnelsTable({ projectId }: { projectId: number }) {
  const queryClient = useQueryClient()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editTunnel, setEditTunnel] = useState<Tunnel | undefined>()

  const { data: tunnels } = useQuery({
    queryKey: ['tunnels', { project: projectId }],
    queryFn: () => tunnelsApi.list({ project: String(projectId) }),
    select: (res) => res.data.results,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => tunnelsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tunnels'] })
      queryClient.invalidateQueries({ queryKey: ['topology'] })
    },
  })

  const openAdd = () => { setEditTunnel(undefined); setDialogOpen(true) }
  const openEdit = (tunnel: Tunnel) => { setEditTunnel(tunnel); setDialogOpen(true) }
  const handleDelete = (tunnel: Tunnel) => {
    if (window.confirm(`Delete tunnel "${tunnel.name}"?`)) deleteMutation.mutate(tunnel.id)
  }

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-muted-foreground">{tunnels?.length ?? 0} tunnels</h3>
        <button onClick={openAdd} className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90">
          <Plus className="h-3.5 w-3.5" /> Add Tunnel
        </button>
      </div>
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
            <th className="px-3 py-2 font-medium w-20"></th>
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
              <td className="px-3 py-2">
                <div className="flex gap-1">
                  <button onClick={() => openEdit(tunnel)} className="p-1 rounded hover:bg-accent" title="Edit">
                    <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                  <button onClick={() => handleDelete(tunnel)} className="p-1 rounded hover:bg-destructive/20" title="Delete">
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen} title={editTunnel ? 'Edit Tunnel' : 'Add Tunnel'}>
        <TunnelForm projectId={projectId} tunnel={editTunnel} onClose={() => setDialogOpen(false)} />
      </Dialog>
    </>
  )
}

// ─── Helpers ──────────────────────────────────────────────────

/** Renders children (multiple <tr>) as a fragment — needed for grouped table rows in .map() */
function GroupRows({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
