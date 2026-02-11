import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { projectsApi } from '@/api/endpoints'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { FolderOpen, Plus, MapPin } from 'lucide-react'

export function DashboardPage() {
  const navigate = useNavigate()
  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.list(),
    select: (res) => res.data.results,
  })

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">IP Address Management</p>
        </div>
        <button
          onClick={() => navigate('/projects')}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          New Project
        </button>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-lg border border-border bg-card p-5 animate-pulse">
              <div className="h-5 bg-muted rounded w-3/4 mb-3" />
              <div className="h-3 bg-muted rounded w-1/2 mb-2" />
              <div className="h-3 bg-muted rounded w-1/3" />
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {projects?.map((project) => (
          <button
            key={project.id}
            onClick={() => navigate(`/projects/${project.id}`)}
            className="rounded-lg border border-border bg-card p-5 text-left hover:border-primary/50 hover:shadow-md transition-all"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <FolderOpen className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">{project.name}</h3>
              </div>
              <StatusBadge status={project.status} />
            </div>
            {project.description && (
              <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{project.description}</p>
            )}
            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {project.site_count} sites
              </span>
              {project.supernet && (
                <span className="font-mono">{project.supernet}</span>
              )}
            </div>
          </button>
        ))}
      </div>

      {projects?.length === 0 && !isLoading && (
        <div className="text-center py-12 text-muted-foreground">
          <FolderOpen className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">No projects yet</p>
          <p className="text-sm mt-1">Create your first project to start managing IP addresses</p>
        </div>
      )}
    </div>
  )
}
