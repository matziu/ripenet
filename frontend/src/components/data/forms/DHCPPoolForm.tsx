import { useForm } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { dhcpPoolsApi } from '@/api/endpoints'
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

export function DHCPPoolForm({ subnetId, pool, onClose }: DHCPPoolFormProps) {
  const queryClient = useQueryClient()

  const { register, handleSubmit } = useForm<FormValues>({
    defaultValues: pool ? {
      start_ip: pool.start_ip,
      end_ip: pool.end_ip,
      description: pool.description,
    } : {},
  })

  const mutation = useMutation({
    mutationFn: (data: FormValues) => {
      const payload = { ...data, subnet: subnetId }
      return pool
        ? dhcpPoolsApi.update(pool.id, payload as Partial<DHCPPool>)
        : dhcpPoolsApi.create(payload as Partial<DHCPPool>)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dhcp-pools'] })
      queryClient.invalidateQueries({ queryKey: ['topology'] })
      toast.success(pool ? 'DHCP Pool updated' : 'DHCP Pool created')
      onClose()
    },
    onError: (err: unknown) => {
      const message = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Failed to save DHCP pool'
      toast.error(message)
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
      </div>

      <div>
        <label className="text-xs font-medium">End IP</label>
        <input
          {...register('end_ip', { required: 'End IP is required' })}
          placeholder="e.g. 10.0.1.200"
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm font-mono"
        />
      </div>

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
