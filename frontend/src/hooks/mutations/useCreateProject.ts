import { useMutation, useQueryClient } from '@tanstack/react-query'
import { projectsApi } from '@/api/endpoints'
import { toast } from 'sonner'
import type { Project } from '@/types'

export function useCreateProject() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: Partial<Project>) => projectsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      toast.success('Project created')
    },
    onError: () => {
      toast.error('Failed to create project')
    },
  })
}
