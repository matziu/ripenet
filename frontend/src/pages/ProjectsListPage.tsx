import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { projectsApi } from '@/api/endpoints'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { toast } from 'sonner'
import { Plus, Trash2 } from 'lucide-react'
import type { Project } from '@/types'

export function ProjectsListPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [newProject, setNewProject] = useState({ name: '', description: '', supernet: '' })

  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.list(),
    select: (res) => res.data.results,
  })

  const createMutation = useMutation({
    mutationFn: (data: Partial<Project>) => projectsApi.create(data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      toast.success('Project created')
      setShowCreate(false)
      setNewProject({ name: '', description: '', supernet: '' })
      navigate(`/projects/${res.data.id}`)
    },
    onError: () => toast.error('Failed to create project'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => projectsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      toast.success('Project deleted')
    },
    onError: () => toast.error('Failed to delete project'),
  })

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Projects</h1>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          New Project
        </button>
      </div>

      {showCreate && (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            createMutation.mutate({
              name: newProject.name,
              description: newProject.description,
              supernet: newProject.supernet || null,
            } as Partial<Project>)
          }}
          className="mb-6 rounded-lg border border-border bg-card p-4 space-y-3"
        >
          <input
            placeholder="Project name"
            value={newProject.name}
            onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            required
          />
          <input
            placeholder="Description"
            value={newProject.description}
            onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
          <input
            placeholder="Supernet (e.g. 10.0.0.0/8)"
            value={newProject.supernet}
            onChange={(e) => setNewProject({ ...newProject, supernet: e.target.value })}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              Create
            </button>
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="rounded-md border border-border px-4 py-2 text-sm hover:bg-accent"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-4 py-3 text-left font-medium">Name</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Supernet</th>
              <th className="px-4 py-3 text-left font-medium">Sites</th>
              <th className="px-4 py-3 text-left font-medium">Created</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {projects?.map((project) => (
              <tr
                key={project.id}
                className="border-b border-border hover:bg-accent/30 cursor-pointer"
                onClick={() => navigate(`/projects/${project.id}`)}
              >
                <td className="px-4 py-3 font-medium">{project.name}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={project.status} />
                </td>
                <td className="px-4 py-3 font-mono text-xs">{project.supernet ?? '-'}</td>
                <td className="px-4 py-3">{project.site_count}</td>
                <td className="px-4 py-3 text-muted-foreground">
                  {new Date(project.created_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      if (confirm('Delete this project?')) deleteMutation.mutate(project.id)
                    }}
                    className="p-1 rounded hover:bg-destructive/10 text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Loading...</td>
              </tr>
            )}
            {!isLoading && projects?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                  No projects yet. Create your first one above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
