import { useForm } from 'react-hook-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { vlansApi, sitesApi } from '@/api/endpoints'
import { toast } from 'sonner'
import type { VLAN } from '@/types'

interface VlanFormProps {
  siteId?: number
  projectId?: number
  vlan?: VLAN
  onClose: () => void
}

interface FormValues {
  vlan_id: string
  name: string
  purpose: string
  description: string
  site: string
}

export function VlanForm({ siteId, projectId, vlan, onClose }: VlanFormProps) {
  const queryClient = useQueryClient()
  const needsSiteSelector = !siteId && !vlan

  const { data: sites } = useQuery({
    queryKey: ['sites', projectId],
    queryFn: () => sitesApi.list(projectId!),
    select: (res) => res.data.results,
    enabled: needsSiteSelector && !!projectId,
  })

  const { register, handleSubmit } = useForm<FormValues>({
    defaultValues: vlan ? {
      vlan_id: String(vlan.vlan_id),
      name: vlan.name,
      purpose: vlan.purpose,
      description: vlan.description,
      site: String(vlan.site),
    } : {
      site: siteId ? String(siteId) : '',
    },
  })

  const mutation = useMutation({
    mutationFn: (data: FormValues) => {
      const resolvedSiteId = siteId ?? parseInt(data.site, 10)
      const payload = {
        vlan_id: parseInt(data.vlan_id, 10),
        name: data.name,
        purpose: data.purpose,
        description: data.description,
        site: resolvedSiteId,
      }
      return vlan
        ? vlansApi.update(vlan.id, payload)
        : vlansApi.create(payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vlans'] })
      queryClient.invalidateQueries({ queryKey: ['topology'] })
      toast.success(vlan ? 'VLAN updated' : 'VLAN created')
      onClose()
    },
    onError: (err: unknown) => {
      const message = (err as { response?: { data?: unknown } })?.response?.data
      const detail = typeof message === 'object' && message !== null
        ? JSON.stringify(message)
        : 'Failed to save VLAN'
      toast.error(detail)
    },
  })

  return (
    <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-3">
      {needsSiteSelector && (
        <div>
          <label className="text-xs font-medium">Site</label>
          <select
            {...register('site', { required: 'Site is required' })}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          >
            <option value="">Choose site...</option>
            {sites?.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium">VLAN ID</label>
          <input
            {...register('vlan_id', {
              required: 'VLAN ID is required',
              min: { value: 1, message: 'Min 1' },
              max: { value: 4094, message: 'Max 4094' },
            })}
            type="number"
            placeholder="1-4094"
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm font-mono"
          />
        </div>
        <div>
          <label className="text-xs font-medium">Name</label>
          <input
            {...register('name', { required: 'Name is required' })}
            placeholder="e.g. Management"
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-medium">Purpose</label>
        <input
          {...register('purpose')}
          placeholder="e.g. Server infrastructure"
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
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
          {mutation.isPending ? 'Saving...' : vlan ? 'Update' : 'Create'}
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
