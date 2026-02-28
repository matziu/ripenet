import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { projectsApi, sitesApi, vlansApi, subnetsApi, hostsApi, tunnelsApi, dhcpPoolsApi } from '@/api/endpoints'
import { useSelectionStore } from '@/stores/selection.store'
import { useUIStore } from '@/stores/ui.store'
import { cn, copyToClipboard } from '@/lib/utils'
import { Dialog } from '@/components/ui/Dialog'
import { DropdownMenu } from '@/components/ui/DropdownMenu'
import { SiteForm } from '@/components/data/forms/SiteForm'
import { VlanForm } from '@/components/data/forms/VlanForm'
import { SubnetForm } from '@/components/data/forms/SubnetForm'
import { HostForm } from '@/components/data/forms/HostForm'
import { DHCPPoolForm } from '@/components/data/forms/DHCPPoolForm'
import { SubnetUtilBar } from '@/components/shared/SubnetUtilBar'
import { ProjectForm } from '@/components/data/forms/ProjectForm'
import { TunnelForm } from '@/components/data/forms/TunnelForm'
import { toast } from 'sonner'
import type { Project, Site, VLAN, Subnet, Host, Tunnel, DHCPPool } from '@/types'
import {
  FolderOpen, MapPin, Network, Server, Monitor,
  ChevronRight, ChevronDown, Plus,
  Pencil, Trash2, Cable, Layers,
  ChevronsUpDown, ChevronsDownUp,
} from 'lucide-react'

interface SidebarProps {
  className?: string
  style?: React.CSSProperties
}

function useCloseSidebarOnMobile() {
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)
  const sidebarOpen = useUIStore((s) => s.sidebarOpen)
  return () => {
    if (sidebarOpen && window.innerWidth < 768) toggleSidebar()
  }
}

export function Sidebar({ className, style }: SidebarProps) {
  const navigate = useNavigate()
  const { projectId } = useParams()
  const location = useLocation()
  const queryClient = useQueryClient()
  const setSelectedProject = useSelectionStore((s) => s.setSelectedProject)
  const expandAll = useSelectionStore((s) => s.expandAll)
  const collapseAll = useSelectionStore((s) => s.collapseAll)
  const expandedProjectIds = useSelectionStore((s) => s.expandedProjectIds)
  const closeMobile = useCloseSidebarOnMobile()

  // Derive view suffix from current URL to preserve it when switching projects
  const viewSuffix = projectId
    ? (location.pathname.split(`/projects/${projectId}`)[1] ?? '').replace(/^\//, '')
    : ''

  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.list(),
    select: (res) => res.data.results,
  })

  const projects = projectsData ?? []

  const hasAnyExpanded = expandedProjectIds.size > 0

  const handleExpandAll = async () => {
    if (!projectId) return
    const pid = Number(projectId)
    try {
      const topo = await queryClient.ensureQueryData({
        queryKey: ['topology', pid],
        queryFn: () => projectsApi.topology(pid),
      })
      const data = topo.data
      const siteIds = data.sites.map((s: { id: number }) => s.id)
      const vlanIds = data.sites.flatMap((s: { vlans: { id: number }[] }) => s.vlans.map((v) => v.id))
      const subnetIds = data.sites.flatMap((s: { vlans: { subnets: { id: number }[] }[] }) =>
        s.vlans.flatMap((v) => v.subnets.map((sub) => sub.id)),
      )
      expandAll([pid], siteIds, vlanIds, subnetIds)
    } catch {
      // Fallback: just expand the project
      expandAll([pid], [], [], [])
    }
  }

  return (
    <aside className={cn('border-r border-border bg-card overflow-y-auto overflow-x-hidden shrink-0 h-full', className)} style={style}>
      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => navigate('/projects')}
            className="text-xs font-semibold uppercase text-muted-foreground tracking-wider hover:text-foreground transition-colors"
          >
            Projects
          </button>
          <div className="flex items-center gap-0.5">
            <button
              onClick={hasAnyExpanded ? collapseAll : handleExpandAll}
              className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              title={hasAnyExpanded ? 'Collapse all' : 'Expand all'}
            >
              {hasAnyExpanded ? (
                <ChevronsDownUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronsUpDown className="h-3.5 w-3.5" />
              )}
            </button>
            <button
              onClick={() => navigate('/projects')}
              className="p-1 rounded hover:bg-accent"
              title="All projects"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <nav className="space-y-0.5">
          {projects.map((project) => (
            <ProjectTreeItem
              key={project.id}
              project={project}
              isActive={String(project.id) === projectId}
              onSelect={() => {
                setSelectedProject(project.id)
                const suffix = viewSuffix ? `/${viewSuffix}` : ''
                navigate(`/projects/${project.id}${suffix}`)
                closeMobile()
              }}
            />
          ))}
          {projects.length === 0 && (
            <p className="text-xs text-muted-foreground px-2 py-4">No projects yet</p>
          )}
        </nav>
      </div>
    </aside>
  )
}

// ── Project ──────────────────────────────────────────────────

function ProjectTreeItem({
  project,
  isActive,
  onSelect,
}: {
  project: Project
  isActive: boolean
  onSelect: () => void
}) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [addSiteOpen, setAddSiteOpen] = useState(false)
  const [addTunnelOpen, setAddTunnelOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const expanded = useSelectionStore((s) => s.expandedProjectIds.has(project.id))
  const toggleExpanded = useSelectionStore((s) => s.toggleExpandedProject)

  const deleteMutation = useMutation({
    mutationFn: () => projectsApi.delete(project.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      toast.success('Project deleted')
      if (isActive) navigate('/projects')
    },
  })

  const { data: sitesData } = useQuery({
    queryKey: ['sites', project.id],
    queryFn: () => sitesApi.list(project.id),
    select: (res) => res.data.results,
    enabled: isActive || expanded,
  })

  const { data: tunnelsData } = useQuery({
    queryKey: ['tunnels', { project: project.id }],
    queryFn: () => tunnelsApi.list({ project: String(project.id) }),
    select: (res) => res.data.results,
    enabled: isActive || expanded,
  })

  const sites = sitesData ?? []
  const tunnels = tunnelsData ?? []
  const isExpanded = isActive && expanded

  const handleClick = () => {
    if (isActive) {
      toggleExpanded(project.id)
    } else {
      onSelect()
      if (!expanded) toggleExpanded(project.id)
    }
  }

  const confirmDelete = () => {
    const msg = project.site_count > 0
      ? `Project "${project.name}" contains ${project.site_count} site(s) with all their VLANs, subnets, and hosts. This action cannot be undone.\n\nAre you sure you want to delete it?`
      : `Delete project "${project.name}"?`
    if (window.confirm(msg)) deleteMutation.mutate()
  }

  return (
    <div>
      <div className="group flex items-center">
        <button
          onClick={handleClick}
          className={cn(
            'flex flex-1 items-center gap-1.5 rounded-md px-2 py-1.5 text-sm transition-colors min-w-0',
            isActive ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50',
          )}
        >
          {isExpanded ? (
            <ChevronDown className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
          )}
          <FolderOpen className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{project.name}</span>
          <span className="ml-auto text-xs text-muted-foreground shrink-0">{project.site_count}</span>
        </button>
        <DropdownMenu items={[
          ...(isActive ? [
            { label: 'Add Site', icon: <MapPin className="h-3 w-3" />, onClick: () => setAddSiteOpen(true) },
            { label: 'Add Tunnel', icon: <Cable className="h-3 w-3" />, onClick: () => setAddTunnelOpen(true) },
          ] : []),
          { label: 'Edit', icon: <Pencil className="h-3 w-3" />, onClick: () => setEditOpen(true) },
          { label: 'Delete', icon: <Trash2 className="h-3 w-3" />, variant: 'destructive' as const, onClick: confirmDelete },
        ]} />
      </div>

      {isExpanded && (
        <div className="ml-3 mt-0.5 space-y-0.5 border-l border-border/50 pl-2">
          {sites.map((site) => (
            <SiteTreeItem key={site.id} site={site} projectId={project.id} />
          ))}
          <div className="group flex items-center px-1.5 pt-1">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Tunnels{tunnels.length > 0 && ` (${tunnels.length})`}
            </span>
            <div className="ml-auto">
              <DropdownMenu items={[
                { label: 'Add Tunnel', icon: <Cable className="h-3 w-3" />, onClick: () => setAddTunnelOpen(true) },
              ]} />
            </div>
          </div>
          {tunnels.map((tunnel) => (
            <TunnelTreeItem key={tunnel.id} tunnel={tunnel} projectId={project.id} />
          ))}
        </div>
      )}

      <Dialog open={addSiteOpen} onOpenChange={setAddSiteOpen} title="Add Site">
        <SiteForm projectId={project.id} onClose={() => setAddSiteOpen(false)} />
      </Dialog>

      <Dialog open={addTunnelOpen} onOpenChange={setAddTunnelOpen} title="Add Tunnel">
        <TunnelForm projectId={project.id} onClose={() => setAddTunnelOpen(false)} />
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen} title="Edit Project">
        <ProjectForm project={project} onClose={() => setEditOpen(false)} />
      </Dialog>
    </div>
  )
}

// ── Site ──────────────────────────────────────────────────────

function SiteTreeItem({ site, projectId }: { site: Site; projectId: number }) {
  const queryClient = useQueryClient()
  const expanded = useSelectionStore((s) => s.expandedSiteIds.has(site.id))
  const toggleExpanded = useSelectionStore((s) => s.toggleExpandedSite)
  const selectedSiteId = useSelectionStore((s) => s.selectedSiteId)
  const setSelectedSite = useSelectionStore((s) => s.setSelectedSite)
  const toggleDetailPanel = useUIStore((s) => s.toggleDetailPanel)
  const detailPanelOpen = useUIStore((s) => s.detailPanelOpen)
  const closeMobile = useCloseSidebarOnMobile()
  const isSelected = selectedSiteId === site.id

  const [addVlanOpen, setAddVlanOpen] = useState(false)
  const [addStandaloneSubnetOpen, setAddStandaloneSubnetOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)

  const deleteMutation = useMutation({
    mutationFn: () => sitesApi.delete(projectId, site.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sites', projectId] })
      queryClient.invalidateQueries({ queryKey: ['topology'] })
      toast.success('Site deleted')
    },
  })

  const { data: vlansData } = useQuery({
    queryKey: ['vlans', { site: String(site.id) }],
    queryFn: () => vlansApi.list({ site: String(site.id) }),
    select: (res) => res.data.results,
    enabled: expanded,
  })

  const { data: standaloneSubnets } = useQuery({
    queryKey: ['subnets', { site: String(site.id), standalone: 'true' }],
    queryFn: () => subnetsApi.list({ site: String(site.id), standalone: 'true' }),
    select: (res) => res.data.results,
    enabled: expanded,
  })

  const vlans = vlansData ?? []

  const handleClick = () => {
    setSelectedSite(site.id)
    if (!detailPanelOpen) toggleDetailPanel()
    closeMobile()
  }

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    toggleExpanded(site.id)
  }

  return (
    <div>
      <div className="group flex items-center">
        <button onClick={handleToggle} className="p-0.5 shrink-0">
          {expanded ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </button>
        <button
          onClick={handleClick}
          className={cn(
            'flex flex-1 items-center gap-1.5 rounded-md px-1.5 py-1 text-xs transition-colors min-w-0',
            isSelected ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50',
          )}
        >
          <MapPin className="h-3 w-3 shrink-0" />
          <span className="truncate">{site.name}</span>
          <span className="ml-auto text-muted-foreground shrink-0">{site.vlan_count}v</span>
        </button>
        <DropdownMenu items={[
          { label: 'Add VLAN', icon: <Network className="h-3 w-3" />, onClick: () => setAddVlanOpen(true) },
          { label: 'Add Subnet', icon: <Server className="h-3 w-3" />, onClick: () => setAddStandaloneSubnetOpen(true) },
          { label: 'Edit', icon: <Pencil className="h-3 w-3" />, onClick: () => setEditOpen(true) },
          { label: 'Delete', icon: <Trash2 className="h-3 w-3" />, variant: 'destructive' as const, onClick: () => {
            if (window.confirm(`Delete site "${site.name}"?`)) deleteMutation.mutate()
          }},
        ]} />
      </div>

      {expanded && (
        <div className="ml-4 mt-0.5 space-y-0.5 border-l border-border/50 pl-2">
          {vlans.map((vlan) => (
            <VlanTreeItem key={vlan.id} vlan={vlan} siteId={site.id} />
          ))}
          <div className="group flex items-center px-1.5 pt-1">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
              Subnets{standaloneSubnets && standaloneSubnets.length > 0 && ` (${standaloneSubnets.length})`}
            </span>
            <div className="ml-auto">
              <DropdownMenu items={[
                { label: 'Add Subnet', icon: <Server className="h-3 w-3" />, onClick: () => setAddStandaloneSubnetOpen(true) },
              ]} />
            </div>
          </div>
          {standaloneSubnets?.map((subnet) => (
            <SubnetTreeItem key={subnet.id} subnet={subnet} />
          ))}
        </div>
      )}

      <Dialog open={addVlanOpen} onOpenChange={setAddVlanOpen} title="Add VLAN">
        <VlanForm siteId={site.id} onClose={() => setAddVlanOpen(false)} />
      </Dialog>

      <Dialog open={addStandaloneSubnetOpen} onOpenChange={setAddStandaloneSubnetOpen} title="Add Standalone Subnet">
        <SubnetForm siteId={site.id} projectId={projectId} onClose={() => setAddStandaloneSubnetOpen(false)} />
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen} title="Edit Site">
        <SiteForm projectId={projectId} site={site} onClose={() => setEditOpen(false)} />
      </Dialog>
    </div>
  )
}

// ── VLAN ──────────────────────────────────────────────────────

function VlanTreeItem({ vlan, siteId }: { vlan: VLAN; siteId: number }) {
  const queryClient = useQueryClient()
  const expanded = useSelectionStore((s) => s.expandedVlanIds.has(vlan.id))
  const toggleExpanded = useSelectionStore((s) => s.toggleExpandedVlan)
  const selectedVlanId = useSelectionStore((s) => s.selectedVlanId)
  const setSelectedVlan = useSelectionStore((s) => s.setSelectedVlan)
  const toggleDetailPanel = useUIStore((s) => s.toggleDetailPanel)
  const detailPanelOpen = useUIStore((s) => s.detailPanelOpen)
  const closeMobile = useCloseSidebarOnMobile()
  const isSelected = selectedVlanId === vlan.id

  const [addSubnetOpen, setAddSubnetOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)

  const deleteMutation = useMutation({
    mutationFn: () => vlansApi.delete(vlan.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vlans'] })
      queryClient.invalidateQueries({ queryKey: ['topology'] })
      toast.success('VLAN deleted')
    },
  })

  const { data: subnetsData } = useQuery({
    queryKey: ['subnets', { vlan: String(vlan.id) }],
    queryFn: () => subnetsApi.list({ vlan: String(vlan.id) }),
    select: (res) => res.data.results,
    enabled: expanded,
  })

  const subnets = subnetsData ?? []

  const handleClick = () => {
    setSelectedVlan(vlan.id)
    if (!detailPanelOpen) toggleDetailPanel()
    closeMobile()
  }

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    toggleExpanded(vlan.id)
  }

  return (
    <div>
      <div className="group flex items-center">
        <button onClick={handleToggle} className="p-0.5 shrink-0">
          {expanded ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </button>
        <button
          onClick={handleClick}
          className={cn(
            'flex flex-1 items-center gap-1.5 rounded-md px-1.5 py-1 text-xs transition-colors min-w-0',
            isSelected ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50',
          )}
        >
          <Network className="h-3 w-3 shrink-0" />
          <span className="shrink-0">VLAN {vlan.vlan_id}</span>
          <span className="truncate text-muted-foreground text-[10px]">{vlan.name}</span>
        </button>
        <DropdownMenu items={[
          { label: 'Add Subnet', icon: <Server className="h-3 w-3" />, onClick: () => setAddSubnetOpen(true) },
          { label: 'Edit', icon: <Pencil className="h-3 w-3" />, onClick: () => setEditOpen(true) },
          { label: 'Delete', icon: <Trash2 className="h-3 w-3" />, variant: 'destructive' as const, onClick: () => {
            if (window.confirm(`Delete VLAN ${vlan.vlan_id}?`)) deleteMutation.mutate()
          }},
        ]} />
      </div>

      {expanded && subnets.length > 0 && (
        <div className="ml-4 mt-0.5 space-y-0.5 border-l border-border/50 pl-2">
          {subnets.map((subnet) => (
            <SubnetTreeItem key={subnet.id} subnet={subnet} vlanId={vlan.id} />
          ))}
        </div>
      )}

      <Dialog open={addSubnetOpen} onOpenChange={setAddSubnetOpen} title="Add Subnet">
        <SubnetForm vlanId={vlan.id} onClose={() => setAddSubnetOpen(false)} />
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen} title="Edit VLAN">
        <VlanForm siteId={siteId} vlan={vlan} onClose={() => setEditOpen(false)} />
      </Dialog>
    </div>
  )
}

// ── Subnet ────────────────────────────────────────────────────

function SubnetTreeItem({ subnet, vlanId }: { subnet: Subnet; vlanId?: number }) {
  const queryClient = useQueryClient()
  const expanded = useSelectionStore((s) => s.expandedSubnetIds.has(subnet.id))
  const toggleExpanded = useSelectionStore((s) => s.toggleExpandedSubnet)
  const selectedSubnetId = useSelectionStore((s) => s.selectedSubnetId)
  const setSelectedSubnet = useSelectionStore((s) => s.setSelectedSubnet)
  const toggleDetailPanel = useUIStore((s) => s.toggleDetailPanel)
  const detailPanelOpen = useUIStore((s) => s.detailPanelOpen)
  const closeMobile = useCloseSidebarOnMobile()
  const isSelected = selectedSubnetId === subnet.id

  const [editOpen, setEditOpen] = useState(false)
  const [addHostOpen, setAddHostOpen] = useState(false)
  const [addPoolOpen, setAddPoolOpen] = useState(false)

  const deleteMutation = useMutation({
    mutationFn: () => subnetsApi.delete(subnet.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subnets'] })
      queryClient.invalidateQueries({ queryKey: ['topology'] })
      toast.success('Subnet deleted')
    },
  })

  const { data: hostsData } = useQuery({
    queryKey: ['hosts', { subnet: String(subnet.id) }],
    queryFn: () => hostsApi.list({ subnet: String(subnet.id) }),
    select: (res) => res.data.results,
    enabled: expanded,
  })

  const { data: dhcpPools } = useQuery({
    queryKey: ['dhcp-pools', { subnet: subnet.id }],
    queryFn: () => dhcpPoolsApi.list({ subnet: String(subnet.id) }),
    select: (res) => res.data.results,
    enabled: expanded,
  })

  const hosts = hostsData ?? []

  const handleClick = () => {
    setSelectedSubnet(subnet.id)
    if (!detailPanelOpen) toggleDetailPanel()
    closeMobile()
  }

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    toggleExpanded(subnet.id)
  }

  return (
    <div>
      <div className="group flex items-center">
        <button onClick={handleToggle} className="p-0.5 shrink-0">
          {expanded ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </button>
        <button
          onClick={handleClick}
          className={cn(
            'flex flex-1 items-center gap-1.5 rounded-md px-1.5 py-1 text-xs transition-colors min-w-0',
            isSelected ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50',
          )}
        >
          <Server className="h-3 w-3 shrink-0" />
          <span className="truncate font-mono text-[11px]">{subnet.network}</span>
          <SubnetUtilBar network={subnet.network} hostCount={subnet.static_host_count} dhcpPoolSize={subnet.dhcp_pool_total_size} className="ml-auto shrink-0" />
        </button>
        <DropdownMenu items={[
          { label: 'Add Host', icon: <Monitor className="h-3 w-3" />, onClick: () => setAddHostOpen(true) },
          { label: 'Add Pool', icon: <Layers className="h-3 w-3" />, onClick: () => setAddPoolOpen(true) },
          { label: 'Edit', icon: <Pencil className="h-3 w-3" />, onClick: () => setEditOpen(true) },
          { label: 'Delete', icon: <Trash2 className="h-3 w-3" />, variant: 'destructive' as const, onClick: () => {
            if (window.confirm(`Delete subnet ${subnet.network}?`)) deleteMutation.mutate()
          }},
        ]} />
      </div>

      {expanded && (hosts.length > 0 || (dhcpPools && dhcpPools.length > 0)) && (
        <div className="ml-4 mt-0.5 space-y-0.5 border-l border-border/50 pl-2">
          {hosts.map((host) => (
            <HostTreeItem key={host.id} host={host} subnetId={subnet.id} />
          ))}
          {dhcpPools?.map((pool) => (
            <DHCPPoolTreeItem key={`pool-${pool.id}`} pool={pool} closeMobile={closeMobile} />
          ))}
        </div>
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen} title="Edit Subnet">
        <SubnetForm
          vlanId={vlanId ?? (subnet.vlan ?? undefined)}
          siteId={subnet.site ?? undefined}
          projectId={subnet.project}
          subnet={subnet}
          onClose={() => setEditOpen(false)}
        />
      </Dialog>

      <Dialog open={addHostOpen} onOpenChange={setAddHostOpen} title="Add Host">
        <HostForm subnetId={subnet.id} onClose={() => setAddHostOpen(false)} />
      </Dialog>

      <Dialog open={addPoolOpen} onOpenChange={setAddPoolOpen} title="Add DHCP Pool">
        <DHCPPoolForm subnetId={subnet.id} onClose={() => setAddPoolOpen(false)} />
      </Dialog>
    </div>
  )
}

// ── Tunnel ───────────────────────────────────────────────────

function TunnelTreeItem({ tunnel, projectId }: { tunnel: Tunnel; projectId: number }) {
  const queryClient = useQueryClient()
  const selectedTunnelId = useSelectionStore((s) => s.selectedTunnelId)
  const setSelectedTunnel = useSelectionStore((s) => s.setSelectedTunnel)
  const toggleDetailPanel = useUIStore((s) => s.toggleDetailPanel)
  const detailPanelOpen = useUIStore((s) => s.detailPanelOpen)
  const closeMobile = useCloseSidebarOnMobile()
  const isSelected = selectedTunnelId === tunnel.id

  const [editOpen, setEditOpen] = useState(false)

  const deleteMutation = useMutation({
    mutationFn: () => tunnelsApi.delete(tunnel.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tunnels'] })
      queryClient.invalidateQueries({ queryKey: ['topology'] })
      toast.success('Tunnel deleted')
    },
  })

  const handleClick = () => {
    setSelectedTunnel(tunnel.id)
    if (!detailPanelOpen) toggleDetailPanel()
    closeMobile()
  }

  return (
    <div>
      <div className="group flex items-center">
        <button
          onClick={handleClick}
          className={cn(
            'flex flex-1 items-center gap-1.5 rounded-md px-1.5 py-1 text-xs transition-colors min-w-0',
            isSelected ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50',
          )}
        >
          <Cable className={cn("h-3 w-3 shrink-0", !tunnel.enabled && "opacity-40")} />
          <span className={cn("truncate", !tunnel.enabled && "opacity-50")}>{tunnel.name}</span>
          {!tunnel.site_b && (
            <span className="text-[9px] text-muted-foreground shrink-0">EXT</span>
          )}
          {tunnel.site_b_project_id && tunnel.site_b_project_id !== projectId && (
            <span className="text-[9px] text-amber-500 shrink-0">XP</span>
          )}
          <span className="ml-auto text-[10px] text-muted-foreground uppercase shrink-0">{tunnel.tunnel_type}</span>
        </button>
        <DropdownMenu items={[
          { label: 'Edit', icon: <Pencil className="h-3 w-3" />, onClick: () => setEditOpen(true) },
          { label: 'Delete', icon: <Trash2 className="h-3 w-3" />, variant: 'destructive', onClick: () => {
            if (window.confirm(`Delete tunnel "${tunnel.name}"?`)) deleteMutation.mutate()
          }},
        ]} />
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen} title="Edit Tunnel">
        <TunnelForm projectId={projectId} tunnel={tunnel} onClose={() => setEditOpen(false)} />
      </Dialog>
    </div>
  )
}

// ── DHCP Pool ────────────────────────────────────────────────

function DHCPPoolTreeItem({ pool, closeMobile }: {
  pool: DHCPPool
  closeMobile: () => void
}) {
  const queryClient = useQueryClient()
  const selectedDhcpPoolId = useSelectionStore((s) => s.selectedDhcpPoolId)
  const setSelectedDhcpPool = useSelectionStore((s) => s.setSelectedDhcpPool)
  const detailPanelOpen = useUIStore((s) => s.detailPanelOpen)
  const toggleDetailPanel = useUIStore((s) => s.toggleDetailPanel)
  const [expanded, setExpanded] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const isSelected = selectedDhcpPoolId === pool.id

  const { data: leases } = useQuery({
    queryKey: ['hosts', { dhcp_pool: pool.id }],
    queryFn: () => hostsApi.list({ dhcp_pool: String(pool.id) }),
    select: (res) => res.data.results,
    enabled: expanded,
  })

  const deleteMutation = useMutation({
    mutationFn: () => dhcpPoolsApi.delete(pool.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dhcp-pools'] })
      queryClient.invalidateQueries({ queryKey: ['subnets'] })
      queryClient.invalidateQueries({ queryKey: ['topology'] })
      toast.success('DHCP Pool deleted')
    },
    onError: (err: unknown) => {
      const message = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Failed to delete'
      toast.error(message)
    },
  })

  const startIp = pool.start_ip.split('/')[0]
  const endIp = pool.end_ip.split('/')[0]

  const handleClick = () => {
    setSelectedDhcpPool(pool.id)
    if (!detailPanelOpen) toggleDetailPanel()
    closeMobile()
  }

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    setExpanded(!expanded)
  }

  return (
    <div>
      <div className="group flex items-center">
        <button onClick={handleToggle} className="p-0.5 shrink-0">
          {expanded ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </button>
        <button
          onClick={handleClick}
          className={cn(
            'flex flex-1 items-center gap-1.5 rounded-md px-1.5 py-1 text-xs transition-colors min-w-0',
            isSelected ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50',
          )}
        >
          <Layers className="h-3 w-3 text-blue-500 shrink-0" />
          <span className="font-mono text-[11px] truncate">
            {startIp}&ndash;{endIp}
          </span>
          <span className="ml-auto text-[10px] text-muted-foreground shrink-0">
            {pool.lease_count}
          </span>
        </button>
        <DropdownMenu items={[
          { label: 'Edit', icon: <Pencil className="h-3 w-3" />, onClick: () => setEditOpen(true) },
          { label: 'Delete', icon: <Trash2 className="h-3 w-3" />, variant: 'destructive', onClick: () => {
            if (window.confirm('Delete this DHCP pool?')) deleteMutation.mutate()
          }},
        ]} />
      </div>

      {expanded && leases && leases.length > 0 && (
        <div className="ml-4 mt-0.5 space-y-0.5 border-l border-border/50 pl-2">
          {leases.map((host) => (
            <HostTreeItem key={host.id} host={host} subnetId={host.subnet} />
          ))}
        </div>
      )}

      <Dialog open={editOpen} onOpenChange={setEditOpen} title="Edit DHCP Pool">
        <DHCPPoolForm subnetId={pool.subnet} pool={pool} onClose={() => setEditOpen(false)} />
      </Dialog>
    </div>
  )
}

// ── Host (leaf) ──────────────────────────────────────────────

function HostTreeItem({ host, subnetId }: { host: Host; subnetId: number }) {
  const queryClient = useQueryClient()
  const selectedHostId = useSelectionStore((s) => s.selectedHostId)
  const setSelectedHost = useSelectionStore((s) => s.setSelectedHost)
  const toggleDetailPanel = useUIStore((s) => s.toggleDetailPanel)
  const detailPanelOpen = useUIStore((s) => s.detailPanelOpen)
  const closeMobile = useCloseSidebarOnMobile()
  const isSelected = selectedHostId === host.id

  const [editOpen, setEditOpen] = useState(false)

  const deleteMutation = useMutation({
    mutationFn: () => hostsApi.delete(host.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hosts'] })
      queryClient.invalidateQueries({ queryKey: ['subnets'] })
      queryClient.invalidateQueries({ queryKey: ['topology'] })
      toast.success('Host deleted')
    },
  })

  const displayIp = host.ip_address.replace(/\/32$/, '')

  const handleClick = () => {
    setSelectedHost(host.id)
    if (!detailPanelOpen) toggleDetailPanel()
    copyToClipboard(displayIp).then(() => {
      toast.success(`Copied ${displayIp}`)
    })
    closeMobile()
  }

  return (
    <div>
      <div className="group flex items-center">
        <button
          onClick={handleClick}
          className={cn(
            'flex flex-1 items-center gap-1.5 rounded-md px-1.5 py-1 text-xs transition-colors min-w-0',
            isSelected ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50',
          )}
        >
          <Monitor className="h-3 w-3 shrink-0" />
          <span className="font-mono text-[11px] shrink-0">{displayIp}</span>
          {host.hostname && (
            <span className="truncate text-muted-foreground text-[10px]">{host.hostname}</span>
          )}
        </button>
        <DropdownMenu items={[
          { label: 'Edit', icon: <Pencil className="h-3 w-3" />, onClick: () => setEditOpen(true) },
          { label: 'Delete', icon: <Trash2 className="h-3 w-3" />, variant: 'destructive', onClick: () => {
            if (window.confirm(`Delete host ${host.ip_address}?`)) deleteMutation.mutate()
          }},
        ]} />
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen} title="Edit Host">
        <HostForm subnetId={subnetId} host={host} onClose={() => setEditOpen(false)} />
      </Dialog>
    </div>
  )
}
