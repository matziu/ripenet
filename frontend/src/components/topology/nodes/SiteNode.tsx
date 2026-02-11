import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import type { SiteNodeData, VlanEmbedded } from '@/lib/topology.utils'
import { getVlanColor } from '@/lib/topology.utils'
import { useTopologyStore } from '@/stores/topology.store'
import { useUIStore } from '@/stores/ui.store'
import { Building2, ChevronDown, ChevronRight, Network } from 'lucide-react'
import { cn } from '@/lib/utils'

function VlanRow({ vlan }: { vlan: VlanEmbedded }) {
  const setSelectedVlan = useTopologyStore((s) => s.setSelectedVlan)
  const toggleDetailPanel = useUIStore((s) => s.toggleDetailPanel)
  const detailPanelOpen = useUIStore((s) => s.detailPanelOpen)
  const highlightedNodeId = useTopologyStore((s) => s.highlightedNodeId)
  const isHighlighted = highlightedNodeId === `vlan-${vlan.id}`

  const color = getVlanColor(vlan.purpose, vlan.colorIndex)

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedVlan(vlan.id)
    if (!detailPanelOpen) toggleDetailPanel()
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer transition-all',
        color.bg,
        color.border,
        'border',
        isHighlighted && 'ring-2 ring-primary/40 shadow-sm',
        'hover:brightness-95 dark:hover:brightness-110',
      )}
      onClick={handleClick}
    >
      <div className={cn('w-2 h-2 rounded-full shrink-0', color.dot)} />
      <div className="flex-1 min-w-0 flex items-center justify-between gap-1">
        <div className="min-w-0">
          <span className={cn('text-[11px] font-semibold', color.text)}>
            VLAN {vlan.vlanId}
          </span>
          <span className="text-[10px] text-muted-foreground ml-1.5">{vlan.name}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {vlan.subnets.length > 0 && (
            <span className="text-[9px] font-mono text-muted-foreground">
              {vlan.subnets[0]}
            </span>
          )}
          <span className="text-[9px] text-muted-foreground bg-background/60 rounded px-1 py-0.5">
            {vlan.hostCount}h
          </span>
        </div>
      </div>
    </div>
  )
}

export const SiteNode = memo(function SiteNode({ data, id }: NodeProps) {
  const d = data as SiteNodeData
  const toggleExpandedSite = useTopologyStore((s) => s.toggleExpandedSite)
  const highlightedNodeId = useTopologyStore((s) => s.highlightedNodeId)
  const isHighlighted = highlightedNodeId === id

  return (
    <div
      className={cn(
        'rounded-lg border-2 bg-card shadow-md transition-all',
        d.expanded ? 'min-w-[260px]' : 'min-w-[180px]',
        isHighlighted
          ? 'border-primary ring-2 ring-primary/30 shadow-lg'
          : 'border-border hover:border-primary/50',
      )}
    >
      <Handle type="target" position={Position.Top} className="!bg-primary !w-2 !h-2" />

      {/* Site header */}
      <div
        className="flex items-center gap-2 px-4 py-3 cursor-pointer"
        onClick={() => toggleExpandedSite(d.siteId)}
      >
        <Building2 className="h-5 w-5 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <span className="font-semibold text-sm truncate">{d.label}</span>
            {d.expanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </div>
          <div className="flex gap-2 text-[10px] text-muted-foreground mt-0.5">
            <span className="flex items-center gap-0.5">
              <Network className="h-3 w-3" />
              {d.vlanCount} VLANs
            </span>
            <span>{d.hostCount} hosts</span>
          </div>
        </div>
      </div>

      {/* Expanded VLANs */}
      {d.expanded && d.vlans.length > 0 && (
        <div className="px-3 pb-3 space-y-1 border-t border-border/50 pt-2">
          {d.vlans.map((vlan) => (
            <VlanRow key={vlan.id} vlan={vlan} />
          ))}
        </div>
      )}

      <Handle type="source" position={Position.Bottom} className="!bg-primary !w-2 !h-2" />
    </div>
  )
})
