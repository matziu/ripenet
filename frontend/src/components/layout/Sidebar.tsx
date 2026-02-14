import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { projectsApi, sitesApi, vlansApi, subnetsApi } from '@/api/endpoints'
import { useSelectionStore } from '@/stores/selection.store'
import { useUIStore } from '@/stores/ui.store'
import { cn } from '@/lib/utils'
import { Dialog } from '@/components/ui/Dialog'
import { DropdownMenu } from '@/components/ui/DropdownMenu'
import { SiteForm } from '@/components/data/forms/SiteForm'
import { VlanForm } from '@/components/data/forms/VlanForm'
import { SubnetForm } from '@/components/data/forms/SubnetForm'
import { toast } from 'sonner'
import type { Site, VLAN, Subnet } from '@/types'
import {
  FolderOpen, MapPin, Network, Server,
  ChevronRight, ChevronDown, Plus,
  Pencil, Trash2,
} from 'lucide-react'

interface SidebarProps {
  className?: string
  style?: React.CSSProperties
}

export function Sidebar({ className, style }: SidebarProps) {
  const navigate = useNavigate()
  const { projectId } = useParams()
  const setSelectedProject = useSelectionStore((s) => s.setSelectedProject)

  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.list(),
    select: (res) => res.data.results,
  })

  const projects = projectsData ?? []

  return (
    <aside className={cn('border-r border-border bg-card overflow-y-auto overflow-x-hidden shrink-0', className)} style={style}>
      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <button
            onClick={() => navigate('/projects')}
            className="text-xs font-semibold uppercase text-muted-foreground tracking-wider hover:text-foreground transition-colors"
          >
            Projects
          </button>
          <button
            onClick={() => navigate('/projects')}
            className="p-1 rounded hover:bg-accent"
            title="All projects"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        <nav className="space-y-0.5">
          {projects.map((project) => (
            <ProjectTreeItem
              key={project.id}
              project={project}
              isActive={String(project.id) === projectId}
              onSelect={() => {
                setSelectedProject(project.id)
                navigate(`/projects/${project.id}`)
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
  project: { id: number; name: string; status: string; site_count: number }
  isActive: boolean
  onSelect: () => void
}) {
  const [addSiteOpen, setAddSiteOpen] = useState(false)
  const expanded = useSelectionStore((s) => s.expandedProjectIds.has(project.id))
  const toggleExpanded = useSelectionStore((s) => s.toggleExpandedProject)

  const { data: sitesData } = useQuery({
    queryKey: ['sites', project.id],
    queryFn: () => sitesApi.list(project.id),
    select: (res) => res.data.results,
    enabled: isActive || expanded,
  })

  const sites = sitesData ?? []
  const isExpanded = isActive && expanded

  const handleClick = () => {
    if (isActive) {
      // Already on this project — just toggle expand/collapse
      toggleExpanded(project.id)
    } else {
      // Navigate to project and auto-expand
      onSelect()
      if (!expanded) toggleExpanded(project.id)
    }
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
        {isActive && (
          <button
            onClick={(e) => { e.stopPropagation(); setAddSiteOpen(true) }}
            className="p-0.5 rounded hover:bg-accent opacity-0 group-hover:opacity-100 transition-opacity mr-1"
            title="Add site"
          >
            <Plus className="h-3 w-3" />
          </button>
        )}
      </div>

      {isExpanded && sites.length > 0 && (
        <div className="ml-3 mt-0.5 space-y-0.5 border-l border-border/50 pl-2">
          {sites.map((site) => (
            <SiteTreeItem key={site.id} site={site} projectId={project.id} />
          ))}
        </div>
      )}

      <Dialog open={addSiteOpen} onOpenChange={setAddSiteOpen} title="Add Site">
        <SiteForm projectId={project.id} onClose={() => setAddSiteOpen(false)} />
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
  const isSelected = selectedSiteId === site.id

  const [addVlanOpen, setAddVlanOpen] = useState(false)
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

  const vlans = vlansData ?? []

  const handleClick = () => {
    setSelectedSite(site.id)
    if (!detailPanelOpen) toggleDetailPanel()
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
        <button
          onClick={(e) => { e.stopPropagation(); setAddVlanOpen(true) }}
          className="p-0.5 rounded hover:bg-accent opacity-0 group-hover:opacity-100 transition-opacity"
          title="Add VLAN"
        >
          <Plus className="h-3 w-3" />
        </button>
        <DropdownMenu items={[
          { label: 'Edit', icon: <Pencil className="h-3 w-3" />, onClick: () => setEditOpen(true) },
          { label: 'Delete', icon: <Trash2 className="h-3 w-3" />, variant: 'destructive', onClick: () => {
            if (window.confirm(`Delete site "${site.name}"?`)) deleteMutation.mutate()
          }},
        ]} />
      </div>

      {expanded && vlans.length > 0 && (
        <div className="ml-4 mt-0.5 space-y-0.5 border-l border-border/50 pl-2">
          {vlans.map((vlan) => (
            <VlanTreeItem key={vlan.id} vlan={vlan} siteId={site.id} />
          ))}
        </div>
      )}

      <Dialog open={addVlanOpen} onOpenChange={setAddVlanOpen} title="Add VLAN">
        <VlanForm siteId={site.id} onClose={() => setAddVlanOpen(false)} />
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
        <button
          onClick={(e) => { e.stopPropagation(); setAddSubnetOpen(true) }}
          className="p-0.5 rounded hover:bg-accent opacity-0 group-hover:opacity-100 transition-opacity"
          title="Add subnet"
        >
          <Plus className="h-3 w-3" />
        </button>
        <DropdownMenu items={[
          { label: 'Edit', icon: <Pencil className="h-3 w-3" />, onClick: () => setEditOpen(true) },
          { label: 'Delete', icon: <Trash2 className="h-3 w-3" />, variant: 'destructive', onClick: () => {
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

// ── Subnet (leaf) ────────────────────────────────────────────

function SubnetTreeItem({ subnet, vlanId }: { subnet: Subnet; vlanId: number }) {
  const queryClient = useQueryClient()
  const selectedSubnetId = useSelectionStore((s) => s.selectedSubnetId)
  const setSelectedSubnet = useSelectionStore((s) => s.setSelectedSubnet)
  const toggleDetailPanel = useUIStore((s) => s.toggleDetailPanel)
  const detailPanelOpen = useUIStore((s) => s.detailPanelOpen)
  const isSelected = selectedSubnetId === subnet.id

  const [editOpen, setEditOpen] = useState(false)

  const deleteMutation = useMutation({
    mutationFn: () => subnetsApi.delete(subnet.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subnets'] })
      queryClient.invalidateQueries({ queryKey: ['topology'] })
      toast.success('Subnet deleted')
    },
  })

  const handleClick = () => {
    setSelectedSubnet(subnet.id)
    if (!detailPanelOpen) toggleDetailPanel()
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
          <Server className="h-3 w-3 shrink-0" />
          <span className="truncate font-mono text-[11px]">{subnet.network}</span>
          <span className="ml-auto text-muted-foreground shrink-0 text-[10px] bg-muted rounded px-1">
            {subnet.host_count}h
          </span>
        </button>
        <DropdownMenu items={[
          { label: 'Edit', icon: <Pencil className="h-3 w-3" />, onClick: () => setEditOpen(true) },
          { label: 'Delete', icon: <Trash2 className="h-3 w-3" />, variant: 'destructive', onClick: () => {
            if (window.confirm(`Delete subnet ${subnet.network}?`)) deleteMutation.mutate()
          }},
        ]} />
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen} title="Edit Subnet">
        <SubnetForm vlanId={vlanId} subnet={subnet} onClose={() => setEditOpen(false)} />
      </Dialog>
    </div>
  )
}
