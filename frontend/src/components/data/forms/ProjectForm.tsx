import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { projectsApi } from '@/api/endpoints'
import { toast } from 'sonner'
import type { Project } from '@/types'

interface ProjectFormProps {
  project: Project
  onClose: () => void
}

export function ProjectForm({ project, onClose }: ProjectFormProps) {
  const queryClient = useQueryClient()
  const [name, setName] = useState(project.name)
  const [description, setDescription] = useState(project.description)
  const [supernet, setSupernet] = useState(project.supernet ?? '')

  const mutation = useMutation({
    mutationFn: (data: Partial<Project>) => projectsApi.update(project.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      queryClient.invalidateQueries({ queryKey: ['topology', project.id] })
      toast.success('Project updated')
      onClose()
    },
    onError: () => toast.error('Failed to update project'),
  })

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        mutation.mutate({ name, description, supernet: supernet || null } as Partial<Project>)
      }}
      className="space-y-3"
    >
      <div>
        <label className="text-xs font-medium">Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          required
        />
      </div>
      <div>
        <label className="text-xs font-medium">Description</label>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
        />
      </div>
      <div>
        <label className="text-xs font-medium">Supernet</label>
        <input
          value={supernet}
          onChange={(e) => setSupernet(e.target.value)}
          placeholder="e.g. 10.0.0.0/8"
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm font-mono"
        />
      </div>
      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={mutation.isPending}
          className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {mutation.isPending ? 'Saving...' : 'Update'}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-border px-4 py-1.5 text-sm hover:bg-accent"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
