import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { projectsApi } from '@/api/endpoints'
import { useUIStore } from '@/stores/ui.store'
import { TopologyCanvas } from '@/components/topology/TopologyCanvas'
import { GeoMap } from '@/components/geo/GeoMap'
import { ProjectTableView } from '@/components/data/tables/ProjectTableView'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { useEffect } from 'react'
import { useSelectionStore } from '@/stores/selection.store'

export function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const id = Number(projectId)
  const viewMode = useUIStore((s) => s.viewMode)
  const setSelectedProject = useSelectionStore((s) => s.setSelectedProject)

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
    const setViewMode = useUIStore.getState().setViewMode
    const handleKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.key === '1') setViewMode('topology')
      else if (e.key === '2') setViewMode('geo')
      else if (e.key === '3') setViewMode('table')
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [])

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
        {viewMode === 'topology' && <TopologyCanvas projectId={id} />}
        {viewMode === 'geo' && <GeoMap projectId={id} />}
        {viewMode === 'table' && <ProjectTableView projectId={id} />}
      </div>
    </div>
  )
}
