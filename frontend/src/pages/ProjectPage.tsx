import { useParams, useNavigate, Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { projectsApi } from '@/api/endpoints'
import { TopologyCanvas } from '@/components/topology/TopologyCanvas'
import { GeoMap } from '@/components/geo/GeoMap'
import { ProjectTableView } from '@/components/data/tables/ProjectTableView'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { useEffect } from 'react'
import { useSelectionStore } from '@/stores/selection.store'

const TAB_NAMES = ['network', 'tunnels'] as const
export type TableTab = (typeof TAB_NAMES)[number]

function parseWildcard(wildcard: string | undefined) {
  if (!wildcard) return { view: 'topology' as const, tab: undefined }
  const parts = wildcard.split('/')
  const view = parts[0] as 'topology' | 'geo' | 'table'
  if (view === 'table') {
    const tab = parts[1] as TableTab | undefined
    return { view, tab: tab && TAB_NAMES.includes(tab) ? tab : undefined }
  }
  if (view === 'topology' || view === 'geo') return { view, tab: undefined }
  return { view: undefined, tab: undefined }
}

export function ProjectPage() {
  const { projectId, '*': wildcard } = useParams<{ projectId: string; '*': string }>()
  const id = Number(projectId)
  const navigate = useNavigate()
  const setSelectedProject = useSelectionStore((s) => s.setSelectedProject)

  const { view, tab } = parseWildcard(wildcard)

  useEffect(() => {
    setSelectedProject(id)
  }, [id, setSelectedProject])

  const { data: project } = useQuery({
    queryKey: ['project', id],
    queryFn: () => projectsApi.get(id),
    select: (res) => res.data,
    enabled: !!id,
  })

  // Keyboard shortcuts for view switching
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return
      if (e.key === '1') navigate(`/projects/${id}/table/network`, { replace: true })
      else if (e.key === '2') navigate(`/projects/${id}/topology`, { replace: true })
      else if (e.key === '3') navigate(`/projects/${id}/geo`, { replace: true })
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [id, navigate])

  // Redirect bare /projects/:id to /projects/:id/topology
  if (!view) {
    return <Navigate to={`/projects/${id}/topology`} replace />
  }
  // Redirect /projects/:id/table to /projects/:id/table/network
  if (view === 'table' && !tab) {
    return <Navigate to={`/projects/${id}/table/network`} replace />
  }

  if (!project) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Loading project...
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Project header */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-2 bg-card/50">
        <h2 className="text-sm font-semibold">{project.name}</h2>
        <StatusBadge status={project.status} />
        {project.supernet && (
          <span className="text-xs font-mono text-muted-foreground">{project.supernet}</span>
        )}
        <div className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground">
          <kbd className="rounded border border-border px-1">1</kbd> Topo
          <kbd className="rounded border border-border px-1 ml-2">2</kbd> Geo
          <kbd className="rounded border border-border px-1 ml-2">3</kbd> Table
        </div>
      </div>

      {/* Main view */}
      <div className="flex-1 overflow-hidden">
        {view === 'topology' && <TopologyCanvas projectId={id} />}
        {view === 'geo' && <GeoMap projectId={id} />}
        {view === 'table' && tab && <ProjectTableView projectId={id} activeTab={tab} />}
      </div>
    </div>
  )
}
