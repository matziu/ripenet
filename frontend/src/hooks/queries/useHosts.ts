import { useQuery } from '@tanstack/react-query'
import { hostsApi, subnetsApi } from '@/api/endpoints'

export function useHosts(params?: Record<string, string>) {
  return useQuery({
    queryKey: ['hosts', params],
    queryFn: () => hostsApi.list(params),
    select: (res) => res.data,
  })
}

export function useHost(id: number) {
  return useQuery({
    queryKey: ['host', id],
    queryFn: () => hostsApi.get(id),
    select: (res) => res.data,
    enabled: !!id,
  })
}

export function useNextFreeIp(subnetId: number) {
  return useQuery({
    queryKey: ['nextFreeIp', subnetId],
    queryFn: () => subnetsApi.nextFreeIp(subnetId),
    select: (res) => res.data.next_free_ip,
    enabled: !!subnetId,
  })
}
