import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { deviceTypesApi } from '@/api/endpoints'
import type { DeviceTypeOption } from '@/types'

const EMPTY_MAP = new Map<string, DeviceTypeOption>()

export function useDeviceTypes(): Map<string, DeviceTypeOption> {
  const { data } = useQuery({
    queryKey: ['device-types'],
    queryFn: () => deviceTypesApi.list(),
    staleTime: 5 * 60 * 1000,
  })

  return useMemo(() => {
    const items = data?.data
    if (!items || items.length === 0) return EMPTY_MAP
    const map = new Map<string, DeviceTypeOption>()
    for (const t of items) {
      map.set(t.value, t)
    }
    return map
  }, [data])
}
