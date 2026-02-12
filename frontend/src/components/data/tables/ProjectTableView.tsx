import { useCallback, useMemo, useState } from 'react'
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
import {
  Plus, Pencil, Trash2,
  Building2, Network, Server, ChevronDown, ChevronRight,
} from 'lucide-react'
import type { TableTab } from '@/pages/ProjectPage'
import type { Site, VLAN, Subnet, Host, Tunnel } from '@/types'

// ─── Tree node types ──────────────────────────────────────────

interface SiteNode {
  site: Site
  vlans: VlanNode[]
}

interface VlanNode {
  vlan: VLAN
  subnets: SubnetNode[]
}

interface SubnetNode {
  subnet: Subnet
  hosts: Host[]
}

// ─── Main component ──────────────────────────────────────────

interface ProjectTableViewProps {
  projectId: number
  activeTab: TableTab
}

export function ProjectTableView({ projectId, activeTab }: ProjectTableViewProps) {
  const navigate = useNavigate()
  const { projectId: pid } = useParams()

  const tabs: { id: TableTab; label: string }[] = [
    { id: 'network', label: 'Network' },
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
        {activeTab === 'network' && <NetworkHierarchy projectId={projectId} />}
        {activeTab === 'tunnels' && <TunnelsTable projectId={projectId} />}
      </div>
    </div>
  )
}

// ─── Network Hierarchy ────────────────────────────────────────

function NetworkHierarchy({ projectId }: { projectId: number }) {
  const queryClient = useQueryClient()

  // Fetch all entities
  const { data: sites } = useQuery({
    queryKey: ['sites', projectId],
    queryFn: () => sitesApi.list(projectId),
    select: (res) => res.data.results,
  })
  const { data: vlans } = useQuery({
    queryKey: ['vlans', { project: projectId }],
    queryFn: () => vlansApi.list({ project: String(projectId) }),
    select: (res) => res.data.results,
  })
  const { data: subnets } = useQuery({
    queryKey: ['subnets', { project: projectId }],
    queryFn: () => subnetsApi.list({ project: String(projectId) }),
    select: (res) => res.data.results,
  })
  const { data: hosts } = useQuery({
    queryKey: ['hosts', { project: projectId }],
    queryFn: () => hostsApi.list({ project: String(projectId) }),
    select: (res) => res.data.results,
  })

  // Build tree
  const tree = useMemo((): SiteNode[] => {
    if (!sites || !vlans || !subnets || !hosts) return []

    const hostsBySubnet = new Map<number, Host[]>()
    for (const h of hosts) {
      const arr = hostsBySubnet.get(h.subnet) ?? []
      arr.push(h)
      hostsBySubnet.set(h.subnet, arr)
    }

    const subnetsByVlan = new Map<number, SubnetNode[]>()
    for (const s of subnets) {
      const arr = subnetsByVlan.get(s.vlan) ?? []
      arr.push({ subnet: s, hosts: hostsBySubnet.get(s.id) ?? [] })
      subnetsByVlan.set(s.vlan, arr)
    }

    const vlansBySite = new Map<number, VlanNode[]>()
    for (const v of vlans) {
      const arr = vlansBySite.get(v.site) ?? []
      arr.push({ vlan: v, subnets: subnetsByVlan.get(v.id) ?? [] })
      vlansBySite.set(v.site, arr)
    }

    return sites.map((site) => ({
      site,
      vlans: vlansBySite.get(site.id) ?? [],
    }))
  }, [sites, vlans, subnets, hosts])

  // Expand/collapse state
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    // Start with all sites expanded
    return new Set<string>()
  })

  const toggle = useCallback((key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const expandAll = useCallback(() => {
    const keys = new Set<string>()
    for (const sn of tree) {
      keys.add(`site-${sn.site.id}`)
      for (const vn of sn.vlans) {
        keys.add(`vlan-${vn.vlan.id}`)
        for (const sub of vn.subnets) {
          keys.add(`subnet-${sub.subnet.id}`)
        }
      }
    }
    setExpanded(keys)
  }, [tree])

  const collapseAll = useCallback(() => setExpanded(new Set()), [])

  // CRUD dialog state
  const [dialog, setDialog] = useState<{
    type: 'site' | 'vlan' | 'subnet' | 'host'
    mode: 'add' | 'edit'
    parentId?: number
    entity?: Site | VLAN | Subnet | Host
  } | null>(null)

  const closeDialog = () => setDialog(null)

  // Delete mutations
  const deleteSite = useMutation({
    mutationFn: (id: number) => sitesApi.delete(projectId, id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['sites', projectId] }); queryClient.invalidateQueries({ queryKey: ['topology'] }) },
  })
  const deleteVlan = useMutation({
    mutationFn: (id: number) => vlansApi.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['vlans'] }); queryClient.invalidateQueries({ queryKey: ['topology'] }) },
  })
  const deleteSubnet = useMutation({
    mutationFn: (id: number) => subnetsApi.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['subnets'] }); queryClient.invalidateQueries({ queryKey: ['topology'] }) },
  })
  const deleteHost = useMutation({
    mutationFn: (id: number) => hostsApi.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['hosts'] }); queryClient.invalidateQueries({ queryKey: ['topology'] }) },
  })

  const totalHosts = hosts?.length ?? 0

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium text-muted-foreground">
            {sites?.length ?? 0} sites, {vlans?.length ?? 0} VLANs, {subnets?.length ?? 0} subnets, {totalHosts} hosts
          </h3>
          <div className="flex gap-1 text-[10px]">
            <button onClick={expandAll} className="rounded border border-border px-1.5 py-0.5 hover:bg-accent text-muted-foreground">
              Expand all
            </button>
            <button onClick={collapseAll} className="rounded border border-border px-1.5 py-0.5 hover:bg-accent text-muted-foreground">
              Collapse all
            </button>
          </div>
        </div>
        <button
          onClick={() => setDialog({ type: 'site', mode: 'add' })}
          className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-3.5 w-3.5" /> Add Site
        </button>
      </div>

      {/* Tree table */}
      <div className="rounded-md border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left">
              <th className="px-3 py-2 font-medium">Name / Identifier</th>
              <th className="px-3 py-2 font-medium">Details</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium w-24 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {tree.map((siteNode) => {
              const siteKey = `site-${siteNode.site.id}`
              const siteOpen = expanded.has(siteKey)

              return (
                <TreeFragment key={siteKey}>
                  {/* Site row */}
                  <tr className="border-b border-border hover:bg-accent/20 bg-muted/30">
                    <td className="px-3 py-2">
                      <button onClick={() => toggle(siteKey)} className="flex items-center gap-1.5 font-medium">
                        {siteOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                        <Building2 className="h-3.5 w-3.5 text-blue-500" />
                        {siteNode.site.name}
                        <span className="text-xs font-normal text-muted-foreground ml-1">
                          ({siteNode.vlans.length} VLANs)
                        </span>
                      </button>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground text-xs">{siteNode.site.address || '-'}</td>
                    <td className="px-3 py-2"></td>
                    <td className="px-3 py-2">
                      <div className="flex justify-end gap-0.5">
                        <button onClick={() => setDialog({ type: 'vlan', mode: 'add', parentId: siteNode.site.id })} className="p-1 rounded hover:bg-accent" title="Add VLAN">
                          <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                        <button onClick={() => setDialog({ type: 'site', mode: 'edit', entity: siteNode.site })} className="p-1 rounded hover:bg-accent" title="Edit site">
                          <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                        <button onClick={() => { if (window.confirm(`Delete site "${siteNode.site.name}"?`)) deleteSite.mutate(siteNode.site.id) }} className="p-1 rounded hover:bg-destructive/20" title="Delete site">
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* VLAN rows */}
                  {siteOpen && siteNode.vlans.map((vlanNode) => {
                    const vlanKey = `vlan-${vlanNode.vlan.id}`
                    const vlanOpen = expanded.has(vlanKey)

                    return (
                      <TreeFragment key={vlanKey}>
                        <tr className="border-b border-border hover:bg-accent/20">
                          <td className="px-3 py-1.5 pl-8">
                            <button onClick={() => toggle(vlanKey)} className="flex items-center gap-1.5 font-medium text-sm">
                              {vlanOpen ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                              <Network className="h-3.5 w-3.5 text-violet-500" />
                              <span className="font-mono text-xs">VLAN {vlanNode.vlan.vlan_id}</span>
                              <span className="font-normal">&mdash; {vlanNode.vlan.name}</span>
                              <span className="text-xs font-normal text-muted-foreground ml-1">
                                ({vlanNode.subnets.length} subnets)
                              </span>
                            </button>
                          </td>
                          <td className="px-3 py-1.5 text-muted-foreground text-xs">{vlanNode.vlan.purpose || '-'}</td>
                          <td className="px-3 py-1.5"></td>
                          <td className="px-3 py-1.5">
                            <div className="flex justify-end gap-0.5">
                              <button onClick={() => setDialog({ type: 'subnet', mode: 'add', parentId: vlanNode.vlan.id })} className="p-1 rounded hover:bg-accent" title="Add subnet">
                                <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                              </button>
                              <button onClick={() => setDialog({ type: 'vlan', mode: 'edit', entity: vlanNode.vlan })} className="p-1 rounded hover:bg-accent" title="Edit VLAN">
                                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                              </button>
                              <button onClick={() => { if (window.confirm(`Delete VLAN "${vlanNode.vlan.name}"?`)) deleteVlan.mutate(vlanNode.vlan.id) }} className="p-1 rounded hover:bg-destructive/20" title="Delete VLAN">
                                <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                              </button>
                            </div>
                          </td>
                        </tr>

                        {/* Subnet rows */}
                        {vlanOpen && vlanNode.subnets.map((subnetNode) => {
                          const subKey = `subnet-${subnetNode.subnet.id}`
                          const subOpen = expanded.has(subKey)

                          return (
                            <TreeFragment key={subKey}>
                              <tr className="border-b border-border hover:bg-accent/20">
                                <td className="px-3 py-1.5 pl-14">
                                  <button onClick={() => toggle(subKey)} className="flex items-center gap-1.5 text-sm">
                                    {subOpen ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                                    <Network className="h-3.5 w-3.5 text-emerald-500" />
                                    <span className="font-mono">{subnetNode.subnet.network}</span>
                                    <span className="text-xs font-normal text-muted-foreground ml-1">
                                      ({subnetNode.hosts.length} hosts)
                                    </span>
                                  </button>
                                </td>
                                <td className="px-3 py-1.5 text-muted-foreground text-xs">
                                  {subnetNode.subnet.gateway ? `gw ${subnetNode.subnet.gateway}` : '-'}
                                  {subnetNode.subnet.description && ` · ${subnetNode.subnet.description}`}
                                </td>
                                <td className="px-3 py-1.5"></td>
                                <td className="px-3 py-1.5">
                                  <div className="flex justify-end gap-0.5">
                                    <button onClick={() => setDialog({ type: 'host', mode: 'add', parentId: subnetNode.subnet.id })} className="p-1 rounded hover:bg-accent" title="Add host">
                                      <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                                    </button>
                                    <button onClick={() => setDialog({ type: 'subnet', mode: 'edit', entity: subnetNode.subnet })} className="p-1 rounded hover:bg-accent" title="Edit subnet">
                                      <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                                    </button>
                                    <button onClick={() => { if (window.confirm(`Delete subnet "${subnetNode.subnet.network}"?`)) deleteSubnet.mutate(subnetNode.subnet.id) }} className="p-1 rounded hover:bg-destructive/20" title="Delete subnet">
                                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                                    </button>
                                  </div>
                                </td>
                              </tr>

                              {/* Host rows */}
                              {subOpen && subnetNode.hosts.map((host) => (
                                <tr key={host.id} className="border-b border-border hover:bg-accent/20">
                                  <td className="px-3 py-1.5 pl-20">
                                    <span className="flex items-center gap-1.5 text-sm">
                                      <Server className="h-3 w-3 text-orange-500" />
                                      <CopyableIP ip={host.ip_address} />
                                      {host.hostname && (
                                        <span className="text-muted-foreground">({host.hostname})</span>
                                      )}
                                    </span>
                                  </td>
                                  <td className="px-3 py-1.5 text-xs text-muted-foreground">
                                    {host.device_type}
                                    {host.mac_address && ` · ${host.mac_address}`}
                                  </td>
                                  <td className="px-3 py-1.5">
                                    <StatusBadge status={host.status} />
                                  </td>
                                  <td className="px-3 py-1.5">
                                    <div className="flex justify-end gap-0.5">
                                      <button onClick={() => setDialog({ type: 'host', mode: 'edit', entity: host })} className="p-1 rounded hover:bg-accent" title="Edit host">
                                        <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                                      </button>
                                      <button onClick={() => { if (window.confirm(`Delete host "${host.hostname || host.ip_address}"?`)) deleteHost.mutate(host.id) }} className="p-1 rounded hover:bg-destructive/20" title="Delete host">
                                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </TreeFragment>
                          )
                        })}
                      </TreeFragment>
                    )
                  })}
                </TreeFragment>
              )
            })}
            {tree.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                  No sites yet. Add your first site to start building the network hierarchy.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* CRUD Dialogs */}
      {dialog?.type === 'site' && (
        <Dialog open onOpenChange={closeDialog} title={dialog.mode === 'edit' ? 'Edit Site' : 'Add Site'}>
          <SiteForm
            projectId={projectId}
            site={dialog.mode === 'edit' ? (dialog.entity as Site) : undefined}
            onClose={closeDialog}
          />
        </Dialog>
      )}
      {dialog?.type === 'vlan' && (
        <Dialog open onOpenChange={closeDialog} title={dialog.mode === 'edit' ? 'Edit VLAN' : 'Add VLAN'}>
          <VlanForm
            siteId={dialog.mode === 'edit' ? (dialog.entity as VLAN).site : dialog.parentId}
            projectId={projectId}
            vlan={dialog.mode === 'edit' ? (dialog.entity as VLAN) : undefined}
            onClose={closeDialog}
          />
        </Dialog>
      )}
      {dialog?.type === 'subnet' && (
        <Dialog open onOpenChange={closeDialog} title={dialog.mode === 'edit' ? 'Edit Subnet' : 'Add Subnet'}>
          <SubnetForm
            vlanId={dialog.mode === 'edit' ? (dialog.entity as Subnet).vlan : dialog.parentId}
            projectId={projectId}
            subnet={dialog.mode === 'edit' ? (dialog.entity as Subnet) : undefined}
            onClose={closeDialog}
          />
        </Dialog>
      )}
      {dialog?.type === 'host' && (
        <Dialog open onOpenChange={closeDialog} title={dialog.mode === 'edit' ? 'Edit Host' : 'Add Host'}>
          <HostForm
            subnetId={dialog.mode === 'edit' ? (dialog.entity as Host).subnet : dialog.parentId}
            projectId={projectId}
            host={dialog.mode === 'edit' ? (dialog.entity as Host) : undefined}
            onClose={closeDialog}
          />
        </Dialog>
      )}
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
      <div className="rounded-md border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left">
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
      </div>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen} title={editTunnel ? 'Edit Tunnel' : 'Add Tunnel'}>
        <TunnelForm projectId={projectId} tunnel={editTunnel} onClose={() => setDialogOpen(false)} />
      </Dialog>
    </>
  )
}

// ─── Helpers ──────────────────────────────────────────────────

function TreeFragment({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
