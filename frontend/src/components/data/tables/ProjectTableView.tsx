import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { sitesApi, vlansApi, subnetsApi, hostsApi, tunnelsApi } from '@/api/endpoints'
import { CopyableIP } from '@/components/shared/CopyableIP'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { SubnetUtilBar } from '@/components/shared/SubnetUtilBar'
import { Dialog } from '@/components/ui/Dialog'
import { SiteForm } from '@/components/data/forms/SiteForm'
import { VlanForm } from '@/components/data/forms/VlanForm'
import { SubnetForm } from '@/components/data/forms/SubnetForm'
import { HostForm } from '@/components/data/forms/HostForm'
import { TunnelForm } from '@/components/data/forms/TunnelForm'
import { cn } from '@/lib/utils'
import {
  Plus, Pencil, Trash2, Globe, Cable,
  Building2, Network, Server, ChevronDown, ChevronRight, MapPin, Wand2,
} from 'lucide-react'
import type { Site, VLAN, Subnet, Host, Tunnel } from '@/types'

// ─── Tree node types ──────────────────────────────────────────

interface SiteNode {
  site: Site
  vlans: VlanNode[]
  standaloneSubnets: SubnetNode[]
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
}

export function ProjectTableView({ projectId }: ProjectTableViewProps) {
  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-auto p-2 md:p-4">
        <NetworkHierarchy projectId={projectId} />
      </div>
    </div>
  )
}

// ─── Network Hierarchy ────────────────────────────────────────

function NetworkHierarchy({ projectId }: { projectId: number }) {
  const navigate = useNavigate()
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
  const { data: tunnels } = useQuery({
    queryKey: ['tunnels', { project: projectId }],
    queryFn: () => tunnelsApi.list({ project: String(projectId) }),
    select: (res) => res.data.results,
  })

  // Build tree
  const tree = useMemo(() => {
    if (!sites || !vlans || !subnets || !hosts) return [] as SiteNode[]

    const hostsBySubnet = new Map<number, Host[]>()
    for (const h of hosts) {
      const arr = hostsBySubnet.get(h.subnet) ?? []
      arr.push(h)
      hostsBySubnet.set(h.subnet, arr)
    }

    const subnetsByVlan = new Map<number, SubnetNode[]>()
    const standaloneBySite = new Map<number, SubnetNode[]>()

    for (const s of subnets) {
      const node: SubnetNode = { subnet: s, hosts: hostsBySubnet.get(s.id) ?? [] }
      if (s.vlan) {
        const arr = subnetsByVlan.get(s.vlan) ?? []
        arr.push(node)
        subnetsByVlan.set(s.vlan, arr)
      } else if (s.site) {
        const arr = standaloneBySite.get(s.site) ?? []
        arr.push(node)
        standaloneBySite.set(s.site, arr)
      }
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
      standaloneSubnets: standaloneBySite.get(site.id) ?? [],
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
      for (const sub of sn.standaloneSubnets) {
        keys.add(`subnet-${sub.subnet.id}`)
      }
    }
    setExpanded(keys)
  }, [tree])

  const collapseAll = useCallback(() => setExpanded(new Set()), [])

  // CRUD dialog state
  const [dialog, setDialog] = useState<{
    type: 'site' | 'vlan' | 'subnet' | 'host' | 'tunnel'
    mode: 'add' | 'edit'
    parentId?: number
    siteId?: number
    entity?: Site | VLAN | Subnet | Host | Tunnel
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
  const deleteTunnel = useMutation({
    mutationFn: (id: number) => tunnelsApi.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['tunnels'] }); queryClient.invalidateQueries({ queryKey: ['topology'] }) },
  })

  const totalHosts = hosts?.length ?? 0
  const totalTunnels = tunnels?.length ?? 0

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          <h3 className="text-xs md:text-sm font-medium text-muted-foreground truncate">
            {sites?.length ?? 0} sites, {vlans?.length ?? 0} VLANs, {subnets?.length ?? 0} subnets, {totalHosts} hosts, {totalTunnels} tunnels
          </h3>
          <div className="flex gap-1 text-[10px] shrink-0">
            <button onClick={expandAll} className="rounded border border-border px-1.5 py-0.5 hover:bg-accent text-muted-foreground">
              Expand
            </button>
            <button onClick={collapseAll} className="rounded border border-border px-1.5 py-0.5 hover:bg-accent text-muted-foreground">
              Collapse
            </button>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => setDialog({ type: 'tunnel', mode: 'add' })}
            className="flex items-center gap-1 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent shrink-0"
          >
            <Cable className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Add</span> Tunnel
          </button>
          <button
            onClick={() => setDialog({ type: 'site', mode: 'add' })}
            className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 shrink-0"
          >
            <Plus className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Add</span> Site
          </button>
        </div>
      </div>

      {/* Tree table */}
      <div className="rounded-md border border-border overflow-x-auto">
        <table className="w-full text-sm min-w-[480px]">
          <thead>
            <tr className="border-b border-border bg-muted/50 text-left">
              <th className="px-2 md:px-3 py-2 font-medium">Name / Identifier</th>
              <th className="px-2 md:px-3 py-2 font-medium hidden sm:table-cell">Details</th>
              <th className="px-2 md:px-3 py-2 font-medium hidden md:table-cell">Status</th>
              <th className="px-2 md:px-3 py-2 font-medium w-20 md:w-24 text-right">Actions</th>
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
                    <td className="px-2 md:px-3 py-2">
                      <button onClick={() => toggle(siteKey)} className="flex items-center gap-1.5 font-medium">
                        {siteOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                        <Building2 className="h-3.5 w-3.5 text-blue-500" />
                        {siteNode.site.name}
                        <span className="text-xs font-normal text-muted-foreground ml-1">
                          ({siteNode.vlans.length} VLANs)
                        </span>
                      </button>
                    </td>
                    <td className="px-2 md:px-3 py-2 text-muted-foreground text-xs hidden sm:table-cell">
                      {siteNode.site.address || '-'}
                      {siteNode.site.wan_addresses?.length > 0 && (
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                          {siteNode.site.wan_addresses.map((w, i) => (
                            <span key={i} className="inline-flex items-center gap-1">
                              <Globe className="h-3 w-3 shrink-0" />
                              <span className="font-mono">{w.ip_address}</span>
                              <span className="opacity-70">{w.label}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-2 md:px-3 py-2 hidden md:table-cell"></td>
                    <td className="px-2 md:px-3 py-2">
                      <div className="flex justify-end gap-0.5">
                        <button onClick={() => setDialog({ type: 'vlan', mode: 'add', parentId: siteNode.site.id })} className="p-1 rounded hover:bg-accent" title="Add VLAN">
                          <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                        </button>
                        <button onClick={() => setDialog({ type: 'subnet', mode: 'add', siteId: siteNode.site.id })} className="p-1 rounded hover:bg-accent" title="Add subnet (standalone)">
                          <Network className="h-3.5 w-3.5 text-muted-foreground" />
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
                          <td className="px-2 md:px-3 py-1.5 pl-6 md:pl-8">
                            <button onClick={() => toggle(vlanKey)} className="flex items-center gap-1.5 font-medium text-sm">
                              {vlanOpen ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                              <Network className="h-3.5 w-3.5 text-violet-500" />
                              <span className="font-mono text-xs">VLAN {vlanNode.vlan.vlan_id}</span>
                              <span className="font-normal hidden sm:inline">&mdash; {vlanNode.vlan.name}</span>
                              <span className="text-xs font-normal text-muted-foreground ml-1">
                                ({vlanNode.subnets.length})
                              </span>
                            </button>
                          </td>
                          <td className="px-2 md:px-3 py-1.5 text-muted-foreground text-xs hidden sm:table-cell">{vlanNode.vlan.purpose || '-'}</td>
                          <td className="px-2 md:px-3 py-1.5 hidden md:table-cell"></td>
                          <td className="px-2 md:px-3 py-1.5">
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
                        {vlanOpen && vlanNode.subnets.map((subnetNode) => (
                          <SubnetRow key={`subnet-${subnetNode.subnet.id}`} subnetNode={subnetNode} expanded={expanded} toggle={toggle} setDialog={setDialog} deleteSubnet={deleteSubnet} deleteHost={deleteHost} indent="vlan" />
                        ))}
                      </TreeFragment>
                    )
                  })}

                  {/* Standalone subnets for this site */}
                  {siteOpen && siteNode.standaloneSubnets.length > 0 && (
                    <tr className="border-b border-border bg-muted/10">
                      <td colSpan={4} className="px-2 md:px-3 py-1 pl-6 md:pl-8">
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Standalone Subnets</span>
                      </td>
                    </tr>
                  )}
                  {siteOpen && siteNode.standaloneSubnets.map((subnetNode) => (
                    <SubnetRow key={`subnet-${subnetNode.subnet.id}`} subnetNode={subnetNode} expanded={expanded} toggle={toggle} setDialog={setDialog} deleteSubnet={deleteSubnet} deleteHost={deleteHost} indent="site" />
                  ))}
                </TreeFragment>
              )
            })}
            {/* Tunnels section */}
            {tunnels && tunnels.length > 0 && (
              <tr className="border-b border-border bg-muted/10">
                <td colSpan={4} className="px-2 md:px-3 py-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-1.5">
                      <Cable className="h-3 w-3" /> Tunnels ({tunnels.length})
                    </span>
                    <button
                      onClick={() => setDialog({ type: 'tunnel', mode: 'add' })}
                      className="p-0.5 rounded hover:bg-accent"
                      title="Add tunnel"
                    >
                      <Plus className="h-3 w-3 text-muted-foreground" />
                    </button>
                  </div>
                </td>
              </tr>
            )}
            {tunnels?.map((tunnel) => (
              <tr key={`tunnel-${tunnel.id}`} className="border-b border-border hover:bg-accent/20">
                <td className="px-2 md:px-3 py-1.5 pl-6 md:pl-8">
                  <span className="flex items-center gap-1.5 text-sm font-medium">
                    <Cable className="h-3.5 w-3.5 text-purple-500" />
                    {tunnel.name}
                    <span className="text-[10px] uppercase text-muted-foreground font-normal">{tunnel.tunnel_type}</span>
                  </span>
                </td>
                <td className="px-2 md:px-3 py-1.5 text-xs text-muted-foreground hidden sm:table-cell">
                  <span className="font-mono">{tunnel.tunnel_subnet}</span>
                  {' · '}
                  {tunnel.site_a_name} (<CopyableIP ip={tunnel.ip_a} />) → {tunnel.site_b_name} (<CopyableIP ip={tunnel.ip_b} />)
                </td>
                <td className="px-2 md:px-3 py-1.5 hidden md:table-cell">
                  <StatusBadge status={tunnel.status} />
                </td>
                <td className="px-2 md:px-3 py-1.5">
                  <div className="flex justify-end gap-0.5">
                    <button onClick={() => setDialog({ type: 'tunnel', mode: 'edit', entity: tunnel })} className="p-1 rounded hover:bg-accent" title="Edit tunnel">
                      <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                    <button onClick={() => { if (window.confirm(`Delete tunnel "${tunnel.name}"?`)) deleteTunnel.mutate(tunnel.id) }} className="p-1 rounded hover:bg-destructive/20" title="Delete tunnel">
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {tree.length === 0 && (!tunnels || tunnels.length === 0) && (
              <tr>
                <td colSpan={4} className="px-4 py-12">
                  <div className="flex flex-col items-center gap-4">
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
                      <MapPin className="h-7 w-7 text-muted-foreground" />
                    </div>
                    <div className="text-center">
                      <p className="font-medium">No sites yet</p>
                      <p className="text-sm text-muted-foreground mt-1">Add your first site or use the wizard for a complete design.</p>
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setDialog({ type: 'site', mode: 'add' })}
                        className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                      >
                        <Plus className="h-4 w-4" />
                        Add Site
                      </button>
                      <button
                        onClick={() => navigate(`/wizard`)}
                        className="flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
                      >
                        <Wand2 className="h-4 w-4" />
                        Design Wizard
                      </button>
                    </div>
                  </div>
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
            vlanId={dialog.mode === 'edit' ? ((dialog.entity as Subnet).vlan ?? undefined) : dialog.parentId}
            siteId={dialog.mode === 'edit' ? ((dialog.entity as Subnet).site ?? undefined) : dialog.siteId}
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
      {dialog?.type === 'tunnel' && (
        <Dialog open onOpenChange={closeDialog} title={dialog.mode === 'edit' ? 'Edit Tunnel' : 'Add Tunnel'}>
          <TunnelForm
            projectId={projectId}
            tunnel={dialog.mode === 'edit' ? (dialog.entity as Tunnel) : undefined}
            onClose={closeDialog}
          />
        </Dialog>
      )}
    </>
  )
}

// ─── SubnetRow (shared between VLAN-attached and standalone) ──

function SubnetRow({
  subnetNode, expanded, toggle, setDialog, deleteSubnet, deleteHost, indent,
}: {
  subnetNode: SubnetNode
  expanded: Set<string>
  toggle: (key: string) => void
  setDialog: (d: { type: 'host' | 'subnet'; mode: 'add' | 'edit'; parentId?: number; entity?: Subnet | Host } | null) => void
  deleteSubnet: { mutate: (id: number) => void }
  deleteHost: { mutate: (id: number) => void }
  indent: 'vlan' | 'site'
}) {
  const subKey = `subnet-${subnetNode.subnet.id}`
  const subOpen = expanded.has(subKey)
  const pl = indent === 'vlan' ? 'pl-10 md:pl-14' : 'pl-6 md:pl-8'
  const hostPl = indent === 'vlan' ? 'pl-14 md:pl-20' : 'pl-10 md:pl-14'

  return (
    <TreeFragment>
      <tr className="border-b border-border hover:bg-accent/20">
        <td className={cn('px-2 md:px-3 py-1.5', pl)}>
          <button onClick={() => toggle(subKey)} className="flex items-center gap-1.5 text-sm">
            {subOpen ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
            <Network className="h-3.5 w-3.5 text-emerald-500" />
            <span className="font-mono text-xs">{subnetNode.subnet.network}</span>
            <SubnetUtilBar network={subnetNode.subnet.network} hostCount={subnetNode.hosts.length} className="ml-2" />
          </button>
        </td>
        <td className="px-2 md:px-3 py-1.5 text-muted-foreground text-xs hidden sm:table-cell">
          {subnetNode.subnet.gateway ? `gw ${subnetNode.subnet.gateway}` : '-'}
          {subnetNode.subnet.description && ` · ${subnetNode.subnet.description}`}
        </td>
        <td className="px-2 md:px-3 py-1.5 hidden md:table-cell"></td>
        <td className="px-2 md:px-3 py-1.5">
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
          <td className={cn('px-2 md:px-3 py-1.5', hostPl)}>
            <span className="flex items-center gap-1.5 text-sm">
              <Server className="h-3 w-3 text-orange-500" />
              <CopyableIP ip={host.ip_address} />
              {host.hostname && (
                <span className="text-muted-foreground hidden sm:inline">({host.hostname})</span>
              )}
            </span>
          </td>
          <td className="px-2 md:px-3 py-1.5 text-xs text-muted-foreground hidden sm:table-cell">
            {host.device_type}
            {host.mac_address && ` · ${host.mac_address}`}
          </td>
          <td className="px-2 md:px-3 py-1.5 text-xs text-muted-foreground hidden md:table-cell">
            {host.device_type}
          </td>
          <td className="px-2 md:px-3 py-1.5">
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
}

// ─── Helpers ──────────────────────────────────────────────────

function TreeFragment({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
