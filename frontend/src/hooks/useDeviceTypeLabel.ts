import { useQuery } from '@tanstack/react-query'
import { deviceTypesApi } from '@/api/endpoints'

export function useDeviceTypeLabel() {
  const { data: types } = useQuery({
    queryKey: ['device-types'],
    queryFn: () => deviceTypesApi.list(),
    select: (res) => {
      const map = new Map<string, string>()
      for (const t of res.data) {
        map.set(t.value, t.label)
      }
      return map
    },
    staleTime: 5 * 60 * 1000,
  })

  return (value: string) => types?.get(value) ?? value
}
