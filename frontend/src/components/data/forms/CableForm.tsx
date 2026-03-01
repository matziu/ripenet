import { useEffect, useMemo } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { cablesApi, physicalTopologyApi } from '@/api/endpoints'
import { extractApiError } from '@/lib/utils'
import { toast } from 'sonner'
import type { Cable } from '@/types'

interface CableFormProps {
  siteId: number
  cable?: Cable
  onClose: () => void
}

interface FormValues {
  device_a: string
  port_a: string
  device_b: string
  port_b: string
  cable_type: string
  label: string
}

const CABLE_TYPES = [
  { value: 'cat5e', label: 'Cat5e' },
  { value: 'cat6', label: 'Cat6' },
  { value: 'cat6a', label: 'Cat6a' },
  { value: 'fiber_sm', label: 'Fiber SM' },
  { value: 'fiber_mm', label: 'Fiber MM' },
  { value: 'dac', label: 'DAC' },
  { value: 'other', label: 'Other' },
]

interface DeviceOption {
  key: string
  label: string
  ports: { id: number; name: string; port_type: string; position: number }[]
}

export function CableForm({ siteId, cable, onClose }: CableFormProps) {
  const queryClient = useQueryClient()

  const { data: topology } = useQuery({
    queryKey: ['physical-topology', siteId],
    queryFn: () => physicalTopologyApi.get(siteId),
    select: (res) => res.data,
  })

  // Build device list from topology
  const devices = useMemo<DeviceOption[]>(() => {
    if (!topology) return []
    const list: DeviceOption[] = []
    topology.hosts.forEach((h) =>
      list.push({
        key: `host-${h.id}`,
        label: `${h.hostname || h.ip_address} (${h.ip_address})`,
        ports: h.ports,
      }),
    )
    topology.patch_panels.forEach((pp) =>
      list.push({
        key: `pp-${pp.id}`,
        label: pp.name,
        ports: pp.ports,
      }),
    )
    return list
  }, [topology])

  // Count cables per port (exclude cable being edited)
  const portCableCount = useMemo(() => {
    if (!topology) return new Map<number, number>()
    const map = new Map<number, number>()
    topology.cables.forEach((c) => {
      if (cable && c.id === cable.id) return
      map.set(c.port_a, (map.get(c.port_a) ?? 0) + 1)
      map.set(c.port_b, (map.get(c.port_b) ?? 0) + 1)
    })
    return map
  }, [topology, cable])

  // PP port IDs (patch panel ports can have up to 2 cables)
  const ppPortIds = useMemo(() => {
    if (!topology) return new Set<number>()
    const set = new Set<number>()
    topology.patch_panels.forEach((pp) => pp.ports.forEach((p) => set.add(p.id)))
    return set
  }, [topology])

  // Find initial device keys for edit mode
  const initialDeviceA = useMemo(() => {
    if (!cable || !topology) return ''
    for (const h of topology.hosts) {
      if (h.ports.some((p) => p.id === cable.port_a)) return `host-${h.id}`
    }
    for (const pp of topology.patch_panels) {
      if (pp.ports.some((p) => p.id === cable.port_a)) return `pp-${pp.id}`
    }
    return ''
  }, [cable, topology])

  const initialDeviceB = useMemo(() => {
    if (!cable || !topology) return ''
    for (const h of topology.hosts) {
      if (h.ports.some((p) => p.id === cable.port_b)) return `host-${h.id}`
    }
    for (const pp of topology.patch_panels) {
      if (pp.ports.some((p) => p.id === cable.port_b)) return `pp-${pp.id}`
    }
    return ''
  }, [cable, topology])

  const { register, handleSubmit, watch, control, setValue, reset } = useForm<FormValues>({
    defaultValues: {
      device_a: '',
      port_a: '',
      device_b: '',
      port_b: '',
      cable_type: cable?.cable_type ?? 'cat6',
      label: cable?.label ?? '',
    },
  })

  // Sync device/port fields when topology loads (edit mode)
  useEffect(() => {
    if (!cable || !initialDeviceA || !initialDeviceB) return
    reset({
      device_a: initialDeviceA,
      port_a: String(cable.port_a),
      device_b: initialDeviceB,
      port_b: String(cable.port_b),
      cable_type: cable.cable_type,
      label: cable.label,
    })
  }, [cable, initialDeviceA, initialDeviceB, reset])

  const watchDeviceA = watch('device_a')
  const watchDeviceB = watch('device_b')
  const watchPortA = watch('port_a')
  const watchPortB = watch('port_b')

  // Check if port is available for a new cable connection
  const isPortAvailable = (portId: number, editPortId?: number) => {
    if (editPortId && portId === editPortId) return true // currently selected in edit mode
    const count = portCableCount.get(portId) ?? 0
    const maxCables = ppPortIds.has(portId) ? 2 : 1
    return count < maxCables
  }

  // Get available ports for device A (free or partially free PP + currently selected)
  const portsForDeviceA = useMemo(() => {
    const device = devices.find((d) => d.key === watchDeviceA)
    if (!device) return []
    return device.ports.filter((p) => isPortAvailable(p.id, cable?.port_a))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devices, watchDeviceA, portCableCount, ppPortIds, cable])

  // Get available ports for device B (free or partially free PP + currently selected, minus port A)
  const portsForDeviceB = useMemo(() => {
    const device = devices.find((d) => d.key === watchDeviceB)
    if (!device) return []
    return device.ports.filter(
      (p) => isPortAvailable(p.id, cable?.port_b) && String(p.id) !== watchPortA,
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devices, watchDeviceB, portCableCount, ppPortIds, cable, watchPortA])

  const mutation = useMutation({
    mutationFn: (data: FormValues) => {
      const payload = {
        port_a: parseInt(data.port_a, 10),
        port_b: parseInt(data.port_b, 10),
        cable_type: data.cable_type,
        label: data.label,
      }
      return cable
        ? cablesApi.update(cable.id, payload as Partial<Cable>)
        : cablesApi.create(payload as Partial<Cable>)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cables'] })
      queryClient.invalidateQueries({ queryKey: ['physical-topology'] })
      queryClient.invalidateQueries({ queryKey: ['ports'] })
      toast.success(cable ? 'Cable updated' : 'Cable created')
      onClose()
    },
    onError: (err: unknown) => {
      toast.error(extractApiError(err, 'Failed to save cable'))
    },
  })

  return (
    <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-3">
      {/* Port A section */}
      <fieldset className="space-y-2 rounded-md border border-border p-2">
        <legend className="px-1 text-xs font-semibold text-muted-foreground">Port A</legend>

        <div>
          <label className="text-xs font-medium">Device A</label>
          <Controller
            control={control}
            name="device_a"
            rules={{ required: 'Device A is required' }}
            render={({ field }) => (
              <select
                {...field}
                onChange={(e) => {
                  field.onChange(e)
                  setValue('port_a', '')
                }}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
              >
                <option value="">Select device...</option>
                {devices.map((d) => (
                  <option key={d.key} value={d.key}>{d.label}</option>
                ))}
              </select>
            )}
          />
        </div>

        <div>
          <label className="text-xs font-medium">Port A</label>
          <select
            {...register('port_a', { required: 'Port A is required' })}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
            disabled={!watchDeviceA}
          >
            <option value="">Select port...</option>
            {portsForDeviceA.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.port_type})
              </option>
            ))}
          </select>
          {watchDeviceA && portsForDeviceA.length === 0 && (
            <p className="text-[10px] text-muted-foreground mt-0.5">
              No free ports on this device
            </p>
          )}
        </div>
      </fieldset>

      {/* Port B section */}
      <fieldset className="space-y-2 rounded-md border border-border p-2">
        <legend className="px-1 text-xs font-semibold text-muted-foreground">Port B</legend>

        <div>
          <label className="text-xs font-medium">Device B</label>
          <Controller
            control={control}
            name="device_b"
            rules={{ required: 'Device B is required' }}
            render={({ field }) => (
              <select
                {...field}
                onChange={(e) => {
                  field.onChange(e)
                  setValue('port_b', '')
                }}
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
              >
                <option value="">Select device...</option>
                {devices.map((d) => (
                  <option key={d.key} value={d.key}>{d.label}</option>
                ))}
              </select>
            )}
          />
        </div>

        <div>
          <label className="text-xs font-medium">Port B</label>
          <select
            {...register('port_b', { required: 'Port B is required' })}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
            disabled={!watchDeviceB}
          >
            <option value="">Select port...</option>
            {portsForDeviceB.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.port_type})
              </option>
            ))}
          </select>
          {watchDeviceB && portsForDeviceB.length === 0 && (
            <p className="text-[10px] text-muted-foreground mt-0.5">
              No free ports on this device
            </p>
          )}
        </div>
      </fieldset>

      <div>
        <label className="text-xs font-medium">Cable Type</label>
        <select
          {...register('cable_type')}
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
        >
          {CABLE_TYPES.map((ct) => (
            <option key={ct.value} value={ct.value}>{ct.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-xs font-medium">Label</label>
        <input
          {...register('label')}
          placeholder="e.g. Rack1-Rack2-01"
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
        />
      </div>

      <div className="flex gap-2 pt-2">
        <button
          type="submit"
          disabled={mutation.isPending || !watchPortA || !watchPortB}
          className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {mutation.isPending ? 'Saving...' : cable ? 'Update' : 'Create'}
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
