import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { projectsApi } from '@/api/endpoints'

import { toast } from 'sonner'
import { Dialog } from '@/components/ui/Dialog'
import { ProjectForm } from '@/components/data/forms/ProjectForm'
import { Plus, Pencil, Trash2, Wand2 } from 'lucide-react'
import type { Project } from '@/types'

export function ProjectsListPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [newProject, setNewProject] = useState({ name: '', description: '', supernet: '' })
  const [editProject, setEditProject] = useState<Project | null>(null)

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

  const confirmDelete = (project: { id: number; name: string; site_count: number }) => {
    const msg = project.site_count > 0
      ? `Project "${project.name}" contains ${project.site_count} site(s) with all their VLANs, subnets, and hosts. This action cannot be undone.\n\nAre you sure you want to delete it?`
      : `Delete project "${project.name}"?`
    if (window.confirm(msg)) deleteMutation.mutate(project.id)
  }

  return (
    <div className="p-3 md:p-6">
      <div className="flex items-center justify-between mb-4 md:mb-6 gap-2">
        <h1 className="text-xl md:text-2xl font-bold">Projects</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/wizard')}
            className="flex items-center gap-2 rounded-md border border-border px-3 md:px-4 py-2 text-sm font-medium hover:bg-accent"
          >
            <Wand2 className="h-4 w-4" />
            <span className="hidden sm:inline">Design Wizard</span>
          </button>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-2 rounded-md bg-primary px-3 md:px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            New Project
          </button>
        </div>
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

      <div className="rounded-lg border border-border overflow-x-auto">
        <table className="w-full text-sm min-w-[500px]">
          <thead>
            <tr className="border-b border-border bg-muted/50">
              <th className="px-3 md:px-4 py-3 text-left font-medium">Name</th>

              <th className="px-3 md:px-4 py-3 text-left font-medium hidden sm:table-cell">Supernet</th>
              <th className="px-3 md:px-4 py-3 text-left font-medium">Sites</th>
              <th className="px-3 md:px-4 py-3 text-left font-medium hidden md:table-cell">Created</th>
              <th className="px-3 md:px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {projects?.map((project) => (
              <tr
                key={project.id}
                className="border-b border-border hover:bg-accent/30 cursor-pointer"
                onClick={() => navigate(`/projects/${project.id}`)}
              >
                <td className="px-3 md:px-4 py-3 font-medium">{project.name}</td>
                <td className="px-3 md:px-4 py-3 font-mono text-xs hidden sm:table-cell">{project.supernet ?? '-'}</td>
                <td className="px-3 md:px-4 py-3">{project.site_count}</td>
                <td className="px-3 md:px-4 py-3 text-muted-foreground hidden md:table-cell">
                  {new Date(project.created_at).toLocaleDateString()}
                </td>
                <td className="px-3 md:px-4 py-3 text-right">
                  <div className="flex justify-end gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setEditProject(project)
                      }}
                      className="p-1 rounded hover:bg-accent"
                      title="Edit"
                    >
                      <Pencil className="h-4 w-4 text-muted-foreground" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        confirmDelete(project)
                      }}
                      className="p-1 rounded hover:bg-destructive/10"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {isLoading && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Loading...</td>
              </tr>
            )}
            {!isLoading && projects?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  No projects yet. Create your first one above.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog
        open={!!editProject}
        onOpenChange={(open) => { if (!open) setEditProject(null) }}
        title="Edit Project"
      >
        {editProject && (
          <ProjectForm project={editProject} onClose={() => setEditProject(null)} />
        )}
      </Dialog>
    </div>
  )
}
