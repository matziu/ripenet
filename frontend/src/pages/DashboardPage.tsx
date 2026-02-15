import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { projectsApi } from '@/api/endpoints'
import { Dialog } from '@/components/ui/Dialog'
import { ProjectForm } from '@/components/data/forms/ProjectForm'
import { toast } from 'sonner'
import { FolderOpen, Plus, MapPin, Wand2, Pencil, Trash2 } from 'lucide-react'
import type { Project } from '@/types'

export function DashboardPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.list(),
    select: (res) => res.data.results,
  })

  const [editProject, setEditProject] = useState<Project | null>(null)

  const deleteMutation = useMutation({
    mutationFn: (id: number) => projectsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      toast.success('Project deleted')
    },
    onError: () => toast.error('Failed to delete project'),
  })

  const handleDelete = (e: React.MouseEvent, project: Project) => {
    e.stopPropagation()
    if (window.confirm(`Delete project "${project.name}" and all its data?`)) {
      deleteMutation.mutate(project.id)
    }
  }

  const handleEdit = (e: React.MouseEvent, project: Project) => {
    e.stopPropagation()
    setEditProject(project)
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">IP Address Management</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/wizard')}
            className="flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            <Wand2 className="h-4 w-4" />
            Design Wizard
          </button>
          <button
            onClick={() => navigate('/projects')}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            New Project
          </button>
        </div>
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
          <div
            key={project.id}
            onClick={() => navigate(`/projects/${project.id}`)}
            className="group rounded-lg border border-border bg-card p-5 text-left hover:border-primary/50 hover:shadow-md transition-all cursor-pointer"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <FolderOpen className="h-5 w-5 text-primary shrink-0" />
                <h3 className="font-semibold truncate">{project.name}</h3>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={(e) => handleEdit(e, project)}
                  className="p-1 rounded hover:bg-accent opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Edit project"
                >
                  <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
                <button
                  onClick={(e) => handleDelete(e, project)}
                  className="p-1 rounded hover:bg-destructive/20 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Delete project"
                >
                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </div>
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
          </div>
        ))}
      </div>

      {projects?.length === 0 && !isLoading && (
        <div className="text-center py-12 text-muted-foreground">
          <FolderOpen className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium">No projects yet</p>
          <p className="text-sm mt-1">Create your first project to start managing IP addresses</p>
        </div>
      )}

      {editProject && (
        <Dialog open onOpenChange={() => setEditProject(null)} title="Edit Project">
          <ProjectForm project={editProject} onClose={() => setEditProject(null)} />
        </Dialog>
      )}
    </div>
  )
}
