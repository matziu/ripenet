import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { projectsApi } from '@/api/endpoints'
import { Dialog } from '@/components/ui/Dialog'
import { SiteForm } from '@/components/data/forms/SiteForm'
import { Plus, MapPin, Wand2 } from 'lucide-react'
import type { SiteTopology } from '@/types'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

// Fix default marker icons in webpack/vite
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

interface GeoMapProps {
  projectId: number
}

function FitBounds({ sites }: { sites: SiteTopology[] }) {
  const map = useMap()

  useEffect(() => {
    const coords = sites
      .filter((s) => s.latitude && s.longitude)
      .map((s) => [s.latitude!, s.longitude!] as [number, number])

    if (coords.length > 0) {
      const bounds = L.latLngBounds(coords)
      map.fitBounds(bounds, { padding: [50, 50] })
    }
  }, [sites, map])

  return null
}

export function GeoMap({ projectId }: GeoMapProps) {
  const { data: topology } = useQuery({
    queryKey: ['topology', projectId],
    queryFn: () => projectsApi.topology(projectId),
    select: (res) => res.data,
  })

  if (!topology) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Loading map...
      </div>
    )
  }

  if (topology.sites.length === 0) {
    return <GeoEmptyState projectId={projectId} hasSites={false} />
  }

  const sitesWithCoords = topology.sites.filter((s) => s.latitude && s.longitude)

  if (sitesWithCoords.length === 0) {
    return <GeoEmptyState projectId={projectId} hasSites />
  }

  const center: [number, number] = [
    sitesWithCoords.reduce((s, site) => s + site.latitude!, 0) / sitesWithCoords.length,
    sitesWithCoords.reduce((s, site) => s + site.longitude!, 0) / sitesWithCoords.length,
  ]

  const siteMap = new Map(topology.sites.map((s) => [s.id, s]))

  return (
    <MapContainer center={center} zoom={6} className="h-full w-full" scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <FitBounds sites={sitesWithCoords} />

      {sitesWithCoords.map((site) => {
        const totalHosts = site.vlans.reduce(
          (sum, v) => sum + v.subnets.reduce((s, sub) => s + sub.hosts.length, 0),
          0,
        )
        return (
          <Marker key={site.id} position={[site.latitude!, site.longitude!]}>
            <Popup>
              <div className="min-w-[200px]">
                <h3 className="font-semibold text-sm">{site.name}</h3>
                <p className="text-xs text-gray-500">{site.address}</p>
                <div className="mt-2 text-xs">
                  <p>{site.vlans.length} VLANs</p>
                  <p>{totalHosts} hosts</p>
                </div>
              </div>
            </Popup>
          </Marker>
        )
      })}

      {topology.tunnels.map((tunnel) => {
        if (!tunnel.site_b) return null
        const sA = siteMap.get(tunnel.site_a)
        if (!sA?.latitude || !sA?.longitude) return null

        // Check if site_b is in current project's sites
        const sB = siteMap.get(tunnel.site_b)
        const bLat = sB?.latitude ?? tunnel.site_b_latitude
        const bLng = sB?.longitude ?? tunnel.site_b_longitude
        if (!bLat || !bLng) return null

        const isCrossProject = !sB && tunnel.site_b_project_id !== null
        const color = tunnel.enabled
          ? (isCrossProject ? '#f59e0b' : '#22c55e')
          : '#94a3b8'

        return (
          <Polyline
            key={tunnel.id}
            positions={[
              [sA.latitude, sA.longitude],
              [bLat, bLng],
            ]}
            color={color}
            weight={2}
            opacity={tunnel.enabled ? 1 : 0.4}
            dashArray="8 4"
          />
        )
      })}
    </MapContainer>
  )
}

function GeoEmptyState({ projectId, hasSites }: { projectId: number; hasSites: boolean }) {
  const navigate = useNavigate()
  const [addSiteOpen, setAddSiteOpen] = useState(false)

  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center max-w-md space-y-4">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <MapPin className="h-8 w-8 text-muted-foreground" />
        </div>
        <div>
          <p className="text-lg font-semibold">
            {hasSites ? 'No geo data' : 'No sites yet'}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {hasSites
              ? 'Add latitude and longitude coordinates to your sites to see them on the map.'
              : 'Add your first site to start building the network, or use the wizard for a complete design.'}
          </p>
        </div>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => setAddSiteOpen(true)}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Add Site
          </button>
          {!hasSites && (
            <button
              onClick={() => navigate('/wizard')}
              className="flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
            >
              <Wand2 className="h-4 w-4" />
              Design Wizard
            </button>
          )}
        </div>
      </div>

      <Dialog open={addSiteOpen} onOpenChange={setAddSiteOpen} title="Add Site">
        <SiteForm projectId={projectId} onClose={() => setAddSiteOpen(false)} />
      </Dialog>
    </div>
  )
}
