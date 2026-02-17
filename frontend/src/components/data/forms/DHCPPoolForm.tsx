import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { dhcpPoolsApi, subnetsApi } from '@/api/endpoints'
import { extractApiError } from '@/lib/utils'
import { toast } from 'sonner'
import type { DHCPPool } from '@/types'

interface DHCPPoolFormProps {
  subnetId: number
  pool?: DHCPPool
  onClose: () => void
}

interface FormValues {
  start_ip: string
  end_ip: string
  description: string
}

function ipToInt(ip: string): number | null {
  const clean = ip.trim().split('/')[0]
  const parts = clean.split('.')
  if (parts.length !== 4) return null
  let result = 0
  for (const p of parts) {
    const n = parseInt(p, 10)
    if (isNaN(n) || n < 0 || n > 255) return null
    result = (result << 8) + n
  }
  return result >>> 0
}


export function DHCPPoolForm({ subnetId, pool, onClose }: DHCPPoolFormProps) {
  const queryClient = useQueryClient()

  // Fetch suggested range for new pools
  const { data: suggested } = useQuery({
    queryKey: ['suggestedPoolRange', subnetId],
    queryFn: () => subnetsApi.suggestedPoolRange(subnetId),
    select: (res) => res.data,
    enabled: !pool,
  })

  const { register, handleSubmit, setValue, watch } = useForm<FormValues>({
    defaultValues: pool ? {
      start_ip: pool.start_ip.split('/')[0],
      end_ip: pool.end_ip.split('/')[0],
      description: pool.description,
    } : {},
  })

  // Auto-fill suggested range
  useEffect(() => {
    if (suggested && !pool) {
      setValue('start_ip', suggested.start_ip)
      setValue('end_ip', suggested.end_ip)
    }
  }, [suggested, pool, setValue])

  const watchStartIp = watch('start_ip')
  const watchEndIp = watch('end_ip')

  // Calculate host count from range
  const hostCount = useMemo(() => {
    if (!watchStartIp || !watchEndIp) return null
    const start = ipToInt(watchStartIp)
    const end = ipToInt(watchEndIp)
    if (start === null || end === null) return null
    if (end < start) return null
    return end - start + 1
  }, [watchStartIp, watchEndIp])

  const mutation = useMutation({
    mutationFn: (data: FormValues) => {
      const payload = { ...data, subnet: subnetId }
      return pool
        ? dhcpPoolsApi.update(pool.id, payload as Partial<DHCPPool>)
        : dhcpPoolsApi.create(payload as Partial<DHCPPool>)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dhcp-pools'] })
      queryClient.invalidateQueries({ queryKey: ['subnets'] })
      queryClient.invalidateQueries({ queryKey: ['topology'] })
      queryClient.invalidateQueries({ queryKey: ['suggestedPoolRange'] })
      toast.success(pool ? 'DHCP Pool updated' : 'DHCP Pool created')
      onClose()
    },
    onError: (err: unknown) => {
      toast.error(extractApiError(err, 'Failed to save DHCP pool'))
    },
  })

  return (
    <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-3">
      <div>
        <label className="text-xs font-medium">Start IP</label>
        <input
          {...register('start_ip', { required: 'Start IP is required' })}
          placeholder="e.g. 10.0.1.100"
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm font-mono"
        />
        {suggested && !pool && (
          <p className="text-[10px] text-muted-foreground mt-0.5">Suggested: {suggested.start_ip}</p>
        )}
      </div>

      <div>
        <label className="text-xs font-medium">End IP</label>
        <input
          {...register('end_ip', { required: 'End IP is required' })}
          placeholder="e.g. 10.0.1.200"
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm font-mono"
        />
        {suggested && !pool && (
          <p className="text-[10px] text-muted-foreground mt-0.5">Suggested: {suggested.end_ip}</p>
        )}
      </div>

      {hostCount !== null && (
        <div className="rounded-md bg-muted/50 px-3 py-2 text-xs">
          <span className="text-muted-foreground">Pool size: </span>
          <span className="font-semibold font-mono">{hostCount}</span>
          <span className="text-muted-foreground"> {hostCount === 1 ? 'address' : 'addresses'}</span>
        </div>
      )}

      <div>
        <label className="text-xs font-medium">Description</label>
        <textarea
          {...register('description')}
          rows={2}
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
        />
      </div>

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={mutation.isPending}
          className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {mutation.isPending ? 'Saving...' : pool ? 'Update' : 'Create'}
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
