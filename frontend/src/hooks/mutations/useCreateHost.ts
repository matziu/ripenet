import { useMutation, useQueryClient } from '@tanstack/react-query'
import { hostsApi } from '@/api/endpoints'
import { toast } from 'sonner'
import type { Host } from '@/types'

export function useCreateHost() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: Partial<Host>) => hostsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hosts'] })
      queryClient.invalidateQueries({ queryKey: ['topology'] })
      toast.success('Host created')
    },
    onError: () => {
      toast.error('Failed to create host')
    },
  })
}
