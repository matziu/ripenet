import { useForm } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { subnetsApi } from '@/api/endpoints'
import { toast } from 'sonner'
import type { Subnet } from '@/types'

interface SubnetFormProps {
  vlanId: number
  subnet?: Subnet
  onClose: () => void
}

interface FormValues {
  network: string
  gateway: string
  description: string
}

export function SubnetForm({ vlanId, subnet, onClose }: SubnetFormProps) {
  const queryClient = useQueryClient()

  const { register, handleSubmit, watch, setValue } = useForm<FormValues>({
    defaultValues: subnet ? {
      network: subnet.network,
      gateway: subnet.gateway ?? '',
      description: subnet.description,
    } : {
      gateway: '',
    },
  })

  const networkValue = watch('network')

  // Auto-suggest gateway as .1
  const suggestGateway = () => {
    if (!networkValue) return
    const match = networkValue.match(/^(\d+\.\d+\.\d+)\.\d+\/\d+$/)
    if (match) {
      setValue('gateway', `${match[1]}.1`)
    }
  }

  const mutation = useMutation({
    mutationFn: (data: FormValues) => {
      const payload = {
        ...data,
        vlan: vlanId,
        gateway: data.gateway || null,
      }
      return subnet
        ? subnetsApi.update(subnet.id, payload)
        : subnetsApi.create(payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subnets'] })
      queryClient.invalidateQueries({ queryKey: ['topology'] })
      toast.success(subnet ? 'Subnet updated' : 'Subnet created')
      onClose()
    },
    onError: (err: unknown) => {
      const message = (err as { response?: { data?: unknown } })?.response?.data
      const detail = typeof message === 'object' && message !== null
        ? JSON.stringify(message)
        : 'Failed to save subnet'
      toast.error(detail)
    },
  })

  return (
    <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-3">
      <div>
        <label className="text-xs font-medium">Network (CIDR)</label>
        <input
          {...register('network', { required: 'Network is required' })}
          placeholder="e.g. 10.0.1.0/24"
          onBlur={suggestGateway}
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm font-mono"
        />
      </div>

      <div>
        <label className="text-xs font-medium">Gateway</label>
        <input
          {...register('gateway')}
          placeholder="e.g. 10.0.1.1 (auto-suggested)"
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
          {mutation.isPending ? 'Saving...' : subnet ? 'Update' : 'Create'}
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
