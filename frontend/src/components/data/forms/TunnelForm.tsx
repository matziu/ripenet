import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { tunnelsApi, sitesApi, projectsApi } from '@/api/endpoints'
import { toast } from 'sonner'
import type { Tunnel, TunnelType } from '@/types'

interface TunnelFormProps {
  projectId: number
  tunnel?: Tunnel
  onClose: () => void
}

type TunnelMode = 'internal' | 'crossProject' | 'external'

interface FormValues {
  name: string
  tunnel_type: TunnelType
  tunnel_subnet: string
  site_a: string
  ip_a: string
  site_b: string
  ip_b: string
  external_endpoint: string
  enabled: boolean
  description: string
}

function getInitialMode(tunnel: Tunnel | undefined, projectId: number): TunnelMode {
  if (!tunnel) return 'internal'
  if (tunnel.external_endpoint) return 'external'
  if (tunnel.site_b_project_id && tunnel.site_b_project_id !== projectId) return 'crossProject'
  return 'internal'
}

export function TunnelForm({ projectId, tunnel, onClose }: TunnelFormProps) {
  const queryClient = useQueryClient()

  const [mode, setMode] = useState<TunnelMode>(() => getInitialMode(tunnel, projectId))
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(() => {
    if (tunnel?.site_b_project_id && tunnel.site_b_project_id !== projectId) {
      return tunnel.site_b_project_id
    }
    return null
  })

  // Sites for current project (always loaded, used for Site A + internal Site B)
  const { data: sites } = useQuery({
    queryKey: ['sites', projectId],
    queryFn: () => sitesApi.list(projectId),
    select: (res) => res.data.results,
  })

  // All projects (loaded when crossProject mode)
  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.list(),
    select: (res) => res.data.results,
    enabled: mode === 'crossProject',
  })

  // Sites for the selected cross-project (loaded when crossProject + project selected)
  const { data: crossProjectSites } = useQuery({
    queryKey: ['sites', selectedProjectId],
    queryFn: () => sitesApi.list(selectedProjectId!),
    select: (res) => res.data.results,
    enabled: mode === 'crossProject' && selectedProjectId !== null,
  })

  const { register, handleSubmit, setValue } = useForm<FormValues>({
    defaultValues: tunnel ? {
      name: tunnel.name,
      tunnel_type: tunnel.tunnel_type,
      tunnel_subnet: tunnel.tunnel_subnet,
      site_a: String(tunnel.site_a),
      ip_a: tunnel.ip_a,
      site_b: tunnel.site_b ? String(tunnel.site_b) : '',
      ip_b: tunnel.ip_b,
      external_endpoint: tunnel.external_endpoint || '',
      enabled: tunnel.enabled,
      description: tunnel.description,
    } : {
      tunnel_type: 'gre',
      enabled: true,
      external_endpoint: '',
    },
  })

  const mutation = useMutation({
    mutationFn: (data: FormValues) => {
      const payload: Record<string, unknown> = {
        name: data.name,
        tunnel_type: data.tunnel_type,
        tunnel_subnet: data.tunnel_subnet,
        site_a: parseInt(data.site_a, 10),
        ip_a: data.ip_a,
        ip_b: data.ip_b,
        enabled: data.enabled,
        description: data.description,
        project: projectId,
      }

      if (mode === 'external') {
        payload.site_b = null
        payload.external_endpoint = data.external_endpoint
      } else {
        payload.site_b = parseInt(data.site_b, 10)
        payload.external_endpoint = ''
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

  // Sites to show in Site B dropdown
  const siteBOptions = mode === 'crossProject' ? crossProjectSites : sites

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

      {/* Site B section -- depends on mode */}
      {mode === 'external' ? (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium">External Endpoint</label>
            <input
              {...register('external_endpoint', { required: 'Endpoint is required' })}
              placeholder="e.g. vpn.partner.com"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm font-mono"
            />
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
      ) : (
        <>
          {mode === 'crossProject' && (
            <div>
              <label className="text-xs font-medium">Remote Project</label>
              <select
                value={selectedProjectId ?? ''}
                onChange={(e) => {
                  const val = e.target.value ? parseInt(e.target.value, 10) : null
                  setSelectedProjectId(val)
                  setValue('site_b', '')
                }}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
              >
                <option value="">Select project...</option>
                {projects?.filter((p) => p.id !== projectId).map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium">Site B</label>
              <select
                {...register('site_b', { required: 'Site B is required' })}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
              >
                <option value="">Select site...</option>
                {siteBOptions?.map((s) => (
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
        </>
      )}

      {/* Mode checkboxes */}
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-1.5 text-xs">
          <input
            type="checkbox"
            checked={mode === 'external'}
            onChange={(e) => {
              if (e.target.checked) {
                setMode('external')
                setValue('site_b', '')
              } else {
                setMode('internal')
                setValue('external_endpoint', '')
              }
            }}
            className="h-3.5 w-3.5 rounded border-input"
          />
          External tunnel
        </label>
        <label className="flex items-center gap-1.5 text-xs">
          <input
            type="checkbox"
            checked={mode === 'crossProject'}
            onChange={(e) => {
              if (e.target.checked) {
                setMode('crossProject')
                setValue('external_endpoint', '')
                setValue('site_b', '')
              } else {
                setMode('internal')
                setSelectedProjectId(null)
                setValue('site_b', '')
              }
            }}
            className="h-3.5 w-3.5 rounded border-input"
          />
          Cross-project tunnel
        </label>
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
