import { useParams, useNavigate, Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { projectsApi } from '@/api/endpoints'
import { TopologyCanvas } from '@/components/topology/TopologyCanvas'
import { GeoMap } from '@/components/geo/GeoMap'
import { ProjectTableView } from '@/components/data/tables/ProjectTableView'
import { PhysicalCanvas } from '@/components/physical/PhysicalCanvas'

import { useCallback, useEffect } from 'react'
import { useSelectionStore } from '@/stores/selection.store'

type ViewType = 'topology' | 'geo' | 'table' | 'physical'

function parseWildcard(wildcard: string | undefined): {
  view: ViewType | undefined
  siteId: number | null
  physicalMode: 'graph' | 'table'
} {
  if (!wildcard) return { view: undefined, siteId: null, physicalMode: 'graph' }
  const parts = wildcard.split('/')
  const view = parts[0] as ViewType
  if (view !== 'topology' && view !== 'geo' && view !== 'table' && view !== 'physical') {
    return { view: undefined, siteId: null, physicalMode: 'graph' }
  }

  let siteId: number | null = null
  let physicalMode: 'graph' | 'table' = 'graph'

  if (view === 'physical') {
    // /projects/:id/physical/:siteId?/:mode?
    if (parts[1]) {
      const parsed = Number(parts[1])
      if (!isNaN(parsed) && parsed > 0) siteId = parsed
    }
    if (parts[2] === 'table') physicalMode = 'table'
  }

  return { view, siteId, physicalMode }
}

export function ProjectPage() {
  const { projectId, '*': wildcard } = useParams<{ projectId: string; '*': string }>()
  const id = Number(projectId)
  const navigate = useNavigate()
  const setSelectedProject = useSelectionStore((s) => s.setSelectedProject)
  const setSelectedSite = useSelectionStore((s) => s.setSelectedSite)

  const { view, siteId: urlSiteId, physicalMode } = parseWildcard(wildcard)

  useEffect(() => {
    setSelectedProject(id)
  }, [id, setSelectedProject])

  // Sync URL siteId to Zustand store (for physical view)
  useEffect(() => {
    if (view === 'physical' && urlSiteId !== null) {
      setSelectedSite(urlSiteId)
    }
  }, [view, urlSiteId, setSelectedSite])

  // Callback for PhysicalCanvas to navigate when site/mode changes
  const handlePhysicalNavigate = useCallback(
    (siteId: number | null, mode: 'graph' | 'table') => {
      if (siteId === null) {
        navigate(`/projects/${id}/physical`, { replace: true })
      } else if (mode === 'table') {
        navigate(`/projects/${id}/physical/${siteId}/table`, { replace: true })
      } else {
        navigate(`/projects/${id}/physical/${siteId}`, { replace: true })
      }
    },
    [id, navigate],
  )

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
      if (e.key === '1') navigate(`/projects/${id}/topology`, { replace: true })
      else if (e.key === '2') navigate(`/projects/${id}/geo`, { replace: true })
      else if (e.key === '3') navigate(`/projects/${id}/table`, { replace: true })
      else if (e.key === '4') navigate(`/projects/${id}/physical`, { replace: true })
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [id, navigate])

  // Redirect bare /projects/:id to /projects/:id/topology
  if (!view) {
    return <Navigate to={`/projects/${id}/topology`} replace />
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
      <div className="flex items-center gap-2 md:gap-3 border-b border-border px-3 md:px-4 py-2 bg-card/50">
        <h2 className="text-sm font-semibold truncate">{project.name}</h2>

        {project.supernet && (
          <span className="text-xs font-mono text-muted-foreground hidden sm:inline">{project.supernet}</span>
        )}
        <div className="ml-auto items-center gap-1 text-[10px] text-muted-foreground hidden md:flex">
          <kbd className="rounded border border-border px-1">1</kbd> Topo
          <kbd className="rounded border border-border px-1 ml-2">2</kbd> Geo
          <kbd className="rounded border border-border px-1 ml-2">3</kbd> Table
          <kbd className="rounded border border-border px-1 ml-2">4</kbd> Physical
        </div>
      </div>

      {/* Main view */}
      <div className="flex-1 overflow-hidden">
        {view === 'topology' && <TopologyCanvas projectId={id} />}
        {view === 'geo' && <GeoMap projectId={id} />}
        {view === 'table' && <ProjectTableView projectId={id} />}
        {view === 'physical' && (
          <PhysicalCanvas
            projectId={id}
            urlSiteId={urlSiteId}
            urlViewMode={physicalMode}
            onNavigate={handlePhysicalNavigate}
          />
        )}
      </div>
    </div>
  )
}
