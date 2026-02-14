import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { sitesApi } from '@/api/endpoints'
import { toast } from 'sonner'
import { Plus, Trash2 } from 'lucide-react'
import type { Site, SiteWanAddress } from '@/types'

interface SiteFormProps {
  projectId: number
  site?: Site
  onClose: () => void
}

interface FormValues {
  name: string
  address: string
}

const COORDS_RE = /^\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\s*$/

function formatCoords(lat: number | null, lng: number | null) {
  return lat != null && lng != null ? `${lat}, ${lng}` : ''
}

export function SiteForm({ projectId, site, onClose }: SiteFormProps) {
  const queryClient = useQueryClient()
  const [coords, setCoords] = useState({ lat: site?.latitude ?? null, lng: site?.longitude ?? null })
  const [coordsInput, setCoordsInput] = useState(formatCoords(site?.latitude ?? null, site?.longitude ?? null))
  const [wanAddresses, setWanAddresses] = useState<SiteWanAddress[]>(site?.wan_addresses ?? [])

  const { register, handleSubmit } = useForm<FormValues>({
    defaultValues: site ? {
      name: site.name,
      address: site.address,
    } : {},
  })

  const parseCoords = (raw: string) => {
    const match = COORDS_RE.exec(raw)
    if (match) {
      setCoords({ lat: parseFloat(match[1]), lng: parseFloat(match[2]) })
    } else if (raw.trim() === '') {
      setCoords({ lat: null, lng: null })
    }
  }

  const mutation = useMutation({
    mutationFn: (data: FormValues) => {
      const filteredWan = wanAddresses.filter((w) => w.ip_address.trim())
      const payload = {
        name: data.name,
        address: data.address,
        latitude: coords.lat,
        longitude: coords.lng,
        wan_addresses: filteredWan.map((w) => ({ ip_address: w.ip_address, label: w.label })),
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

      <div>
        <label className="text-xs font-medium">Coordinates</label>
        <input
          value={coordsInput}
          onChange={(e) => setCoordsInput(e.target.value)}
          onBlur={(e) => parseCoords(e.target.value)}
          onPaste={(e) => {
            const text = e.clipboardData.getData('text')
            if (COORDS_RE.test(text)) {
              e.preventDefault()
              setCoordsInput(text.trim())
              parseCoords(text)
            }
          }}
          placeholder="e.g. 52.2297, 21.0122  (paste from Google Maps)"
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm font-mono"
        />
      </div>

      {/* WAN Addresses */}
      <div>
        <label className="text-xs font-medium">WAN Addresses</label>
        <div className="mt-1 space-y-1.5">
          {wanAddresses.map((wan, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <input
                value={wan.ip_address}
                onChange={(e) =>
                  setWanAddresses((prev) =>
                    prev.map((w, i) => (i === idx ? { ...w, ip_address: e.target.value } : w)),
                  )
                }
                placeholder="IP address"
                className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm font-mono"
              />
              <input
                value={wan.label}
                onChange={(e) =>
                  setWanAddresses((prev) =>
                    prev.map((w, i) => (i === idx ? { ...w, label: e.target.value } : w)),
                  )
                }
                placeholder="Label (e.g. ISP1)"
                className="w-32 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
              />
              <button
                type="button"
                onClick={() => setWanAddresses((prev) => prev.filter((_, i) => i !== idx))}
                className="p-1.5 rounded hover:bg-destructive/10"
              >
                <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setWanAddresses((prev) => [...prev, { ip_address: '', label: '' }])}
          className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <Plus className="h-3 w-3" /> Add WAN address
        </button>
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
