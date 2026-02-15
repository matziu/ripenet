import { useForm } from 'react-hook-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { subnetsApi, vlansApi } from '@/api/endpoints'
import { toast } from 'sonner'
import type { Subnet } from '@/types'

interface SubnetFormProps {
  vlanId?: number
  siteId?: number
  projectId?: number
  subnet?: Subnet
  onClose: () => void
}

interface FormValues {
  network: string
  gateway: string
  description: string
  vlan: string
}

export function SubnetForm({ vlanId, siteId, projectId, subnet, onClose }: SubnetFormProps) {
  const queryClient = useQueryClient()
  const needsVlanSelector = !vlanId && !siteId && !subnet

  const { data: vlans } = useQuery({
    queryKey: ['vlans', { project: projectId }],
    queryFn: () => vlansApi.list({ project: String(projectId!) }),
    select: (res) => res.data.results,
    enabled: needsVlanSelector && !!projectId,
  })

  const { register, handleSubmit, watch, setValue } = useForm<FormValues>({
    defaultValues: subnet ? {
      network: subnet.network,
      gateway: subnet.gateway ?? '',
      description: subnet.description,
      vlan: subnet.vlan ? String(subnet.vlan) : '',
    } : {
      gateway: '',
      vlan: vlanId ? String(vlanId) : '',
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
      const payload: Record<string, unknown> = {
        network: data.network,
        gateway: data.gateway || null,
        description: data.description,
      }

      if (vlanId) {
        // Under a VLAN — backend auto-derives project/site
        payload.vlan = vlanId
      } else if (siteId && projectId) {
        // Site-level standalone (no VLAN)
        payload.site = siteId
        payload.project = projectId
        payload.vlan = null
      } else if (projectId && !siteId) {
        // Project-wide standalone
        payload.project = projectId
        payload.site = null
        payload.vlan = null
      } else if (data.vlan) {
        // VLAN chosen from selector
        payload.vlan = parseInt(data.vlan, 10)
      } else if (subnet) {
        // Editing existing — preserve relations
        payload.project = subnet.project
        payload.site = subnet.site
        payload.vlan = subnet.vlan
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
      {needsVlanSelector && (
        <div>
          <label className="text-xs font-medium">VLAN</label>
          <select
            {...register('vlan', { required: 'VLAN is required' })}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          >
            <option value="">Choose VLAN...</option>
            {vlans?.map((v) => (
              <option key={v.id} value={v.id}>{v.name} (VLAN {v.vlan_id})</option>
            ))}
          </select>
        </div>
      )}

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
