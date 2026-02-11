import { useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet'
import { useQuery } from '@tanstack/react-query'
import { projectsApi } from '@/api/endpoints'
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

  const sitesWithCoords = topology.sites.filter((s) => s.latitude && s.longitude)

  if (sitesWithCoords.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <div className="text-center">
          <p className="text-lg font-medium">No geo data</p>
          <p className="text-sm mt-1">Add coordinates to sites to see them on the map</p>
        </div>
      </div>
    )
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
        const sA = siteMap.get(tunnel.site_a)
        const sB = siteMap.get(tunnel.site_b)
        if (!sA?.latitude || !sA?.longitude || !sB?.latitude || !sB?.longitude) return null

        const color = tunnel.status === 'active' ? '#22c55e' : tunnel.status === 'down' ? '#ef4444' : '#3b82f6'

        return (
          <Polyline
            key={tunnel.id}
            positions={[
              [sA.latitude, sA.longitude],
              [sB.latitude, sB.longitude],
            ]}
            color={color}
            weight={2}
            dashArray={tunnel.status === 'planned' ? '8 4' : undefined}
          />
        )
      })}
    </MapContainer>
  )
}
