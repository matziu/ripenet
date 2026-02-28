import { useForm } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { portsApi } from '@/api/endpoints'
import { extractApiError } from '@/lib/utils'
import { toast } from 'sonner'
import type { DevicePort } from '@/types'

interface PortFormProps {
  hostId?: number
  patchPanelId?: number
  port?: DevicePort
  onClose: () => void
}

interface FormValues {
  name: string
  port_type: string
  description: string
}

const PORT_TYPES = [
  { value: 'rj45', label: 'RJ45' },
  { value: 'sfp', label: 'SFP' },
  { value: 'sfp+', label: 'SFP+' },
  { value: 'qsfp28', label: 'QSFP28' },
  { value: 'console', label: 'Console' },
]

export function PortForm({ hostId, patchPanelId, port, onClose }: PortFormProps) {
  const queryClient = useQueryClient()

  const { register, handleSubmit } = useForm<FormValues>({
    defaultValues: port
      ? {
          name: port.name,
          port_type: port.port_type,
          description: port.description,
        }
      : {
          name: '',
          port_type: 'rj45',
          description: '',
        },
  })

  const mutation = useMutation({
    mutationFn: (data: FormValues) => {
      const payload: Record<string, unknown> = {
        name: data.name,
        port_type: data.port_type,
        description: data.description,
      }
      if (!port) {
        if (hostId) payload.host = hostId
        if (patchPanelId) payload.patch_panel = patchPanelId
      }
      return port
        ? portsApi.update(port.id, payload as Partial<DevicePort>)
        : portsApi.create(payload as Partial<DevicePort>)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ports'] })
      queryClient.invalidateQueries({ queryKey: ['physical-topology'] })
      toast.success(port ? 'Port updated' : 'Port created')
      onClose()
    },
    onError: (err: unknown) => {
      toast.error(extractApiError(err, 'Failed to save port'))
    },
  })

  return (
    <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-3">
      <div>
        <label className="text-xs font-medium">Name</label>
        <input
          {...register('name', { required: 'Name is required' })}
          placeholder="e.g. GigE0/1"
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
        />
      </div>

      <div>
        <label className="text-xs font-medium">Port Type</label>
        <select
          {...register('port_type')}
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
        >
          {PORT_TYPES.map((pt) => (
            <option key={pt.value} value={pt.value}>{pt.label}</option>
          ))}
        </select>
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
          {mutation.isPending ? 'Saving...' : port ? 'Update' : 'Create'}
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
