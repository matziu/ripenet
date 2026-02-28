import { useForm } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { patchPanelsApi } from '@/api/endpoints'
import { extractApiError } from '@/lib/utils'
import { toast } from 'sonner'
import type { PatchPanel } from '@/types'

interface PatchPanelFormProps {
  siteId: number
  patchPanel?: PatchPanel
  onClose: () => void
}

interface FormValues {
  name: string
  port_count: number
  description: string
}

export function PatchPanelForm({ siteId, patchPanel, onClose }: PatchPanelFormProps) {
  const queryClient = useQueryClient()

  const { register, handleSubmit } = useForm<FormValues>({
    defaultValues: patchPanel
      ? {
          name: patchPanel.name,
          port_count: patchPanel.port_count,
          description: patchPanel.description,
        }
      : {
          name: '',
          port_count: 24,
          description: '',
        },
  })

  const mutation = useMutation({
    mutationFn: (data: FormValues) => {
      const payload: Record<string, unknown> = {
        site: siteId,
        name: data.name,
        description: data.description,
      }
      if (!patchPanel) {
        payload.port_count = data.port_count
      }
      return patchPanel
        ? patchPanelsApi.update(patchPanel.id, payload as Partial<PatchPanel>)
        : patchPanelsApi.create(payload as Partial<PatchPanel>)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patch-panels'] })
      queryClient.invalidateQueries({ queryKey: ['physical-topology'] })
      toast.success(patchPanel ? 'Patch panel updated' : 'Patch panel created')
      onClose()
    },
    onError: (err: unknown) => {
      toast.error(extractApiError(err, 'Failed to save patch panel'))
    },
  })

  return (
    <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-3">
      <div>
        <label className="text-xs font-medium">Name</label>
        <input
          {...register('name', { required: 'Name is required' })}
          placeholder="e.g. PP-Rack1-01"
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
        />
      </div>

      {!patchPanel && (
        <div>
          <label className="text-xs font-medium">Port Count</label>
          <input
            type="number"
            {...register('port_count', { required: true, min: 1, valueAsNumber: true })}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          />
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Ports will be auto-created. Cannot be changed after creation.
          </p>
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
          {mutation.isPending ? 'Saving...' : patchPanel ? 'Update' : 'Create'}
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
