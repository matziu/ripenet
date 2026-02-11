import { useUIStore } from '@/stores/ui.store'
import { useTopologyStore } from '@/stores/topology.store'
import { useQuery } from '@tanstack/react-query'
import { vlansApi, hostsApi } from '@/api/endpoints'
import { CopyableIP } from '@/components/shared/CopyableIP'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { X } from 'lucide-react'

export function DetailPanel() {
  const toggleDetailPanel = useUIStore((s) => s.toggleDetailPanel)
  const selectedVlanId = useTopologyStore((s) => s.selectedVlanId)

  const { data: vlan } = useQuery({
    queryKey: ['vlan', selectedVlanId],
    queryFn: () => vlansApi.get(selectedVlanId!),
    select: (res) => res.data,
    enabled: !!selectedVlanId,
  })

  const { data: hostsData } = useQuery({
    queryKey: ['hosts', { vlan: selectedVlanId }],
    queryFn: () => hostsApi.list({ vlan: String(selectedVlanId) }),
    select: (res) => res.data.results,
    enabled: !!selectedVlanId,
  })

  const hosts = hostsData ?? []

  return (
    <aside className="w-80 border-l border-border bg-card overflow-y-auto">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <h3 className="text-sm font-semibold">
          {vlan ? `VLAN ${vlan.vlan_id} - ${vlan.name}` : 'Details'}
        </h3>
        <button onClick={toggleDetailPanel} className="p-1 rounded hover:bg-accent">
          <X className="h-4 w-4" />
        </button>
      </div>

      {vlan && (
        <div className="p-3 space-y-3">
          {vlan.purpose && (
            <p className="text-xs text-muted-foreground">{vlan.purpose}</p>
          )}

          <div>
            <h4 className="text-xs font-semibold uppercase text-muted-foreground mb-2">
              Hosts ({hosts.length})
            </h4>
            <div className="space-y-1">
              {hosts.map((host) => (
                <div
                  key={host.id}
                  className="flex items-center justify-between rounded-md border border-border p-2 text-xs"
                >
                  <div className="min-w-0">
                    <CopyableIP ip={host.ip_address} />
                    {host.hostname && (
                      <p className="text-muted-foreground truncate mt-0.5">{host.hostname}</p>
                    )}
                  </div>
                  <StatusBadge status={host.status} />
                </div>
              ))}
              {hosts.length === 0 && (
                <p className="text-xs text-muted-foreground">No hosts in this VLAN</p>
              )}
            </div>
          </div>
        </div>
      )}

      {!vlan && (
        <div className="p-3 text-xs text-muted-foreground">
          Select a VLAN on the topology to see its hosts.
        </div>
      )}
    </aside>
  )
}
