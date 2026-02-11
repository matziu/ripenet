import { useQuery } from '@tanstack/react-query'
import { projectsApi } from '@/api/endpoints'

export function useProjects(params?: Record<string, string>) {
  return useQuery({
    queryKey: ['projects', params],
    queryFn: () => projectsApi.list(params),
    select: (res) => res.data,
  })
}

export function useProject(id: number) {
  return useQuery({
    queryKey: ['project', id],
    queryFn: () => projectsApi.get(id),
    select: (res) => res.data,
    enabled: !!id,
  })
}

export function useProjectTopology(id: number) {
  return useQuery({
    queryKey: ['topology', id],
    queryFn: () => projectsApi.topology(id),
    select: (res) => res.data,
    enabled: !!id,
  })
}
