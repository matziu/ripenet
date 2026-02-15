import { useForm } from 'react-hook-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { tunnelsApi, sitesApi } from '@/api/endpoints'
import { toast } from 'sonner'
import type { Tunnel, TunnelType } from '@/types'

interface TunnelFormProps {
  projectId: number
  tunnel?: Tunnel
  onClose: () => void
}

interface FormValues {
  name: string
  tunnel_type: TunnelType
  tunnel_subnet: string
  site_a: string
  ip_a: string
  site_b: string
  ip_b: string
  enabled: boolean
  description: string
}

export function TunnelForm({ projectId, tunnel, onClose }: TunnelFormProps) {
  const queryClient = useQueryClient()

  const { data: sites } = useQuery({
    queryKey: ['sites', projectId],
    queryFn: () => sitesApi.list(projectId),
    select: (res) => res.data.results,
  })

  const { register, handleSubmit } = useForm<FormValues>({
    defaultValues: tunnel ? {
      name: tunnel.name,
      tunnel_type: tunnel.tunnel_type,
      tunnel_subnet: tunnel.tunnel_subnet,
      site_a: String(tunnel.site_a),
      ip_a: tunnel.ip_a,
      site_b: String(tunnel.site_b),
      ip_b: tunnel.ip_b,
      enabled: tunnel.enabled,
      description: tunnel.description,
    } : {
      tunnel_type: 'gre',
      enabled: true,
    },
  })

  const mutation = useMutation({
    mutationFn: (data: FormValues) => {
      const payload = {
        name: data.name,
        tunnel_type: data.tunnel_type,
        tunnel_subnet: data.tunnel_subnet,
        site_a: parseInt(data.site_a, 10),
        ip_a: data.ip_a,
        site_b: parseInt(data.site_b, 10),
        ip_b: data.ip_b,
        enabled: data.enabled,
        description: data.description,
        project: projectId,
      }
      return tunnel
        ? tunnelsApi.update(tunnel.id, payload)
        : tunnelsApi.create(payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tunnels'] })
      queryClient.invalidateQueries({ queryKey: ['topology'] })
      toast.success(tunnel ? 'Tunnel updated' : 'Tunnel created')
      onClose()
    },
    onError: (err: unknown) => {
      const message = (err as { response?: { data?: unknown } })?.response?.data
      const detail = typeof message === 'object' && message !== null
        ? JSON.stringify(message)
        : 'Failed to save tunnel'
      toast.error(detail)
    },
  })

  return (
    <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-3">
      <div>
        <label className="text-xs font-medium">Name</label>
        <input
          {...register('name', { required: 'Name is required' })}
          placeholder="e.g. HQ-Branch-GRE"
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium">Tunnel Type</label>
          <select
            {...register('tunnel_type')}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          >
            <option value="gre">GRE</option>
            <option value="ipsec">IPsec</option>
            <option value="vxlan">VXLAN</option>
            <option value="wireguard">WireGuard</option>
          </select>
        </div>
        <div className="flex items-center gap-2 self-end pb-1.5">
          <input
            type="checkbox"
            {...register('enabled')}
            id="tunnel-enabled"
            className="h-4 w-4 rounded border-input"
          />
          <label htmlFor="tunnel-enabled" className="text-xs font-medium">Enabled</label>
        </div>
      </div>

      <div>
        <label className="text-xs font-medium">Tunnel Subnet (CIDR)</label>
        <input
          {...register('tunnel_subnet', { required: 'Subnet is required' })}
          placeholder="e.g. 172.16.0.0/30"
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm font-mono"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium">Site A</label>
          <select
            {...register('site_a', { required: 'Site A is required' })}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          >
            <option value="">Select site...</option>
            {sites?.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium">IP A</label>
          <input
            {...register('ip_a', { required: 'IP A is required' })}
            placeholder="e.g. 172.16.0.1"
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm font-mono"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium">Site B</label>
          <select
            {...register('site_b', { required: 'Site B is required' })}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          >
            <option value="">Select site...</option>
            {sites?.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium">IP B</label>
          <input
            {...register('ip_b', { required: 'IP B is required' })}
            placeholder="e.g. 172.16.0.2"
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm font-mono"
          />
        </div>
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
          {mutation.isPending ? 'Saving...' : tunnel ? 'Update' : 'Create'}
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
