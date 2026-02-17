import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { hostsApi, subnetsApi, dhcpPoolsApi } from '@/api/endpoints'
import { toast } from 'sonner'
import type { Host } from '@/types'

interface HostFormProps {
  subnetId?: number
  projectId?: number
  host?: Host
  defaultIpType?: 'static' | 'dhcp_lease'
  defaultDhcpPoolId?: number
  onClose: () => void
}

interface FormValues {
  ip_address: string
  hostname: string
  mac_address: string
  device_type: string
  ip_type: string
  dhcp_pool: string
  description: string
  subnet: string
}

export function HostForm({ subnetId, projectId, host, defaultIpType, defaultDhcpPoolId, onClose }: HostFormProps) {
  const queryClient = useQueryClient()
  const needsSubnetSelector = !subnetId && !host

  const { data: subnets } = useQuery({
    queryKey: ['subnets', { project: projectId }],
    queryFn: () => subnetsApi.list({ project: String(projectId!) }),
    select: (res) => res.data.results,
    enabled: needsSubnetSelector && !!projectId,
  })

  const resolvedSubnetId = subnetId ?? (host ? host.subnet : undefined)

  const { register, handleSubmit, setValue, watch } = useForm<FormValues>({
    defaultValues: host ? {
      ip_address: host.ip_address,
      hostname: host.hostname,
      mac_address: host.mac_address,
      device_type: host.device_type,
      ip_type: host.ip_type ?? 'static',
      dhcp_pool: host.dhcp_pool ? String(host.dhcp_pool) : '',
      description: host.description,
      subnet: String(host.subnet),
    } : {
      device_type: 'other',
      ip_type: defaultIpType ?? 'static',
      dhcp_pool: defaultDhcpPoolId ? String(defaultDhcpPoolId) : '',
      subnet: subnetId ? String(subnetId) : '',
    },
  })

  const selectedSubnet = watch('subnet')
  const effectiveSubnetId = resolvedSubnetId ?? (selectedSubnet ? parseInt(selectedSubnet, 10) : undefined)

  const { data: dhcpPools } = useQuery({
    queryKey: ['dhcp-pools', { subnet: effectiveSubnetId }],
    queryFn: () => dhcpPoolsApi.list({ subnet: String(effectiveSubnetId!) }),
    select: (res) => res.data.results,
    enabled: !!effectiveSubnetId,
  })

  const watchIpType = watch('ip_type')
  const watchDhcpPool = watch('dhcp_pool')
  const selectedPoolId = watchIpType === 'dhcp_lease' && watchDhcpPool ? parseInt(watchDhcpPool, 10) : undefined

  // Suggest next free IP — for leases: within pool range; for static: outside pools
  const { data: nextFreeIp } = useQuery({
    queryKey: ['nextFreeIp', effectiveSubnetId, selectedPoolId],
    queryFn: () => subnetsApi.nextFreeIp(effectiveSubnetId!, selectedPoolId),
    select: (res) => res.data.next_free_ip,
    enabled: !host && !!effectiveSubnetId && (watchIpType === 'static' || !!selectedPoolId),
  })

  useEffect(() => {
    if (nextFreeIp && !host) {
      setValue('ip_address', nextFreeIp)
    }
  }, [nextFreeIp, host, setValue])

  const mutation = useMutation({
    mutationFn: (data: FormValues) => {
      const finalSubnetId = subnetId ?? parseInt(data.subnet, 10)
      const payload = {
        ip_address: data.ip_address,
        hostname: data.hostname,
        mac_address: data.mac_address,
        device_type: data.device_type,
        ip_type: data.ip_type,
        dhcp_pool: data.ip_type === 'dhcp_lease' ? parseInt(data.dhcp_pool, 10) : null,
        description: data.description,
        subnet: finalSubnetId,
      } as Record<string, unknown>
      return host
        ? hostsApi.update(host.id, payload as Partial<Host>)
        : hostsApi.create(payload as Partial<Host>)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hosts'] })
      queryClient.invalidateQueries({ queryKey: ['topology'] })
      queryClient.invalidateQueries({ queryKey: ['dhcp-pools'] })
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
      {needsSubnetSelector && (
        <div>
          <label className="text-xs font-medium">Subnet</label>
          <select
            {...register('subnet', { required: 'Subnet is required' })}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          >
            <option value="">Choose subnet...</option>
            {subnets?.map((s) => (
              <option key={s.id} value={s.id}>{s.network}</option>
            ))}
          </select>
        </div>
      )}

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
          <option value="nas">NAS</option>
          <option value="camera">Camera</option>
          <option value="printer">Printer</option>
          <option value="phone">Phone</option>
          <option value="workstation">Workstation</option>
          <option value="other">Other</option>
        </select>
      </div>

      <div>
        <label className="text-xs font-medium">IP Type</label>
        <select
          {...register('ip_type')}
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
        >
          <option value="static">Static IP</option>
          <option value="dhcp_lease">DHCP Static Lease</option>
        </select>
      </div>

      {watchIpType === 'dhcp_lease' && (
        <div>
          <label className="text-xs font-medium">DHCP Pool</label>
          <select
            {...register('dhcp_pool', {
              validate: (val) => watchIpType !== 'dhcp_lease' || !!val || 'DHCP Pool is required for leases',
            })}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          >
            <option value="">Choose pool...</option>
            {dhcpPools?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.start_ip.split('/')[0]} – {p.end_ip.split('/')[0]}
              </option>
            ))}
          </select>
          {(!dhcpPools || dhcpPools.length === 0) && (
            <p className="text-[10px] text-muted-foreground mt-0.5">
              No DHCP pools in this subnet. Create one first.
            </p>
          )}
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
