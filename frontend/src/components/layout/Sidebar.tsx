import { useQuery } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'
import { projectsApi, sitesApi } from '@/api/endpoints'
import { useSelectionStore } from '@/stores/selection.store'
import { cn } from '@/lib/utils'
import {
  FolderOpen, MapPin, ChevronRight, ChevronDown, Plus,
} from 'lucide-react'

interface SidebarProps {
  className?: string
}

export function Sidebar({ className }: SidebarProps) {
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
    <aside className={cn('border-r border-border bg-card overflow-y-auto overflow-x-hidden', className)}>
      <div className="p-3">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xs font-semibold uppercase text-muted-foreground tracking-wider">Projects</h2>
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

function ProjectTreeItem({
  project,
  isActive,
  onSelect,
}: {
  project: { id: number; name: string; status: string; site_count: number }
  isActive: boolean
  onSelect: () => void
}) {
  const { data: sitesData } = useQuery({
    queryKey: ['sites', project.id],
    queryFn: () => sitesApi.list(project.id),
    select: (res) => res.data.results,
    enabled: isActive,
  })

  const sites = sitesData ?? []

  return (
    <div>
      <button
        onClick={onSelect}
        className={cn(
          'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors',
          isActive ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50',
        )}
      >
        {isActive && sites.length > 0 ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
        )}
        <FolderOpen className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{project.name}</span>
        <span className="ml-auto text-xs text-muted-foreground">{project.site_count}</span>
      </button>

      {isActive && sites.length > 0 && (
        <div className="ml-4 mt-0.5 space-y-0.5">
          {sites.map((site) => (
            <button
              key={site.id}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-xs hover:bg-accent/50 transition-colors"
            >
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{site.name}</span>
              <span className="ml-auto text-muted-foreground">{site.vlan_count}v</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
