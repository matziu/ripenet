import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { hostsApi, subnetsApi } from '@/api/endpoints'
import { toast } from 'sonner'
import type { Host } from '@/types'

interface HostFormProps {
  subnetId: number
  host?: Host
  onClose: () => void
}

interface FormValues {
  ip_address: string
  hostname: string
  mac_address: string
  status: string
  device_type: string
  description: string
}

export function HostForm({ subnetId, host, onClose }: HostFormProps) {
  const queryClient = useQueryClient()
  const { register, handleSubmit, setValue } = useForm<FormValues>({
    defaultValues: host ? {
      ip_address: host.ip_address,
      hostname: host.hostname,
      mac_address: host.mac_address,
      status: host.status,
      device_type: host.device_type,
      description: host.description,
    } : {
      status: 'planned',
      device_type: 'other',
    },
  })

  // Suggest next free IP
  const { data: nextFreeIp } = useQuery({
    queryKey: ['nextFreeIp', subnetId],
    queryFn: () => subnetsApi.nextFreeIp(subnetId),
    select: (res) => res.data.next_free_ip,
    enabled: !host,
  })

  useEffect(() => {
    if (nextFreeIp && !host) {
      setValue('ip_address', nextFreeIp)
    }
  }, [nextFreeIp, host, setValue])

  const mutation = useMutation({
    mutationFn: (data: FormValues) => {
      const payload = { ...data, subnet: subnetId } as Record<string, unknown>
      return host
        ? hostsApi.update(host.id, payload as Partial<Host>)
        : hostsApi.create(payload as Partial<Host>)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hosts'] })
      queryClient.invalidateQueries({ queryKey: ['topology'] })
      toast.success(host ? 'Host updated' : 'Host created')
      onClose()
    },
    onError: (err: unknown) => {
      const message = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Failed to save host'
      toast.error(message)
    },
  })

  return (
    <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-3">
      <div>
        <label className="text-xs font-medium">IP Address</label>
        <input
          {...register('ip_address', { required: 'IP is required' })}
          placeholder="e.g. 10.0.1.1"
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm font-mono"
        />
        {nextFreeIp && !host && (
          <p className="text-[10px] text-muted-foreground mt-0.5">Suggested: {nextFreeIp}</p>
        )}
      </div>

      <div>
        <label className="text-xs font-medium">Hostname</label>
        <input
          {...register('hostname')}
          placeholder="e.g. sw-core-01"
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
        />
      </div>

      <div>
        <label className="text-xs font-medium">MAC Address</label>
        <input
          {...register('mac_address')}
          placeholder="AA:BB:CC:DD:EE:FF"
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm font-mono"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium">Status</label>
          <select
            {...register('status')}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          >
            <option value="planned">Planned</option>
            <option value="active">Active</option>
            <option value="reserved">Reserved</option>
            <option value="dhcp">DHCP</option>
            <option value="decommissioned">Decommissioned</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium">Device Type</label>
          <select
            {...register('device_type')}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          >
            <option value="server">Server</option>
            <option value="router">Router</option>
            <option value="switch">Switch</option>
            <option value="firewall">Firewall</option>
            <option value="ap">Access Point</option>
            <option value="camera">Camera</option>
            <option value="printer">Printer</option>
            <option value="phone">Phone</option>
            <option value="workstation">Workstation</option>
            <option value="other">Other</option>
          </select>
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
          {mutation.isPending ? 'Saving...' : host ? 'Update' : 'Create'}
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
