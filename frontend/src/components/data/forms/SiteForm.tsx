import { useForm } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { sitesApi } from '@/api/endpoints'
import { toast } from 'sonner'
import type { Site } from '@/types'

interface SiteFormProps {
  projectId: number
  site?: Site
  onClose: () => void
}

interface FormValues {
  name: string
  address: string
  latitude: string
  longitude: string
}

export function SiteForm({ projectId, site, onClose }: SiteFormProps) {
  const queryClient = useQueryClient()

  const { register, handleSubmit } = useForm<FormValues>({
    defaultValues: site ? {
      name: site.name,
      address: site.address,
      latitude: site.latitude?.toString() ?? '',
      longitude: site.longitude?.toString() ?? '',
    } : {},
  })

  const mutation = useMutation({
    mutationFn: (data: FormValues) => {
      const payload = {
        name: data.name,
        address: data.address,
        latitude: data.latitude ? parseFloat(data.latitude) : null,
        longitude: data.longitude ? parseFloat(data.longitude) : null,
      }
      return site
        ? sitesApi.update(projectId, site.id, payload)
        : sitesApi.create(projectId, payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sites', projectId] })
      queryClient.invalidateQueries({ queryKey: ['topology'] })
      toast.success(site ? 'Site updated' : 'Site created')
      onClose()
    },
    onError: (err: unknown) => {
      const message = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Failed to save site'
      toast.error(message)
    },
  })

  return (
    <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-3">
      <div>
        <label className="text-xs font-medium">Name</label>
        <input
          {...register('name', { required: 'Name is required' })}
          placeholder="e.g. HQ Building"
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
        />
      </div>

      <div>
        <label className="text-xs font-medium">Address</label>
        <input
          {...register('address')}
          placeholder="e.g. 123 Main St, Warsaw"
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium">Latitude</label>
          <input
            {...register('latitude')}
            placeholder="e.g. 52.2297"
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm font-mono"
          />
        </div>
        <div>
          <label className="text-xs font-medium">Longitude</label>
          <input
            {...register('longitude')}
            placeholder="e.g. 21.0122"
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm font-mono"
          />
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={mutation.isPending}
          className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {mutation.isPending ? 'Saving...' : site ? 'Update' : 'Create'}
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
