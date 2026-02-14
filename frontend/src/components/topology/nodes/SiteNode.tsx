import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import type { SiteNodeData, VlanEmbedded } from '@/lib/topology.utils'
import { getVlanColor } from '@/lib/topology.utils'
import { useTopologyStore } from '@/stores/topology.store'
import { useSelectionStore } from '@/stores/selection.store'
import { useUIStore } from '@/stores/ui.store'
import { Building2, ChevronDown, ChevronRight, Globe, Network } from 'lucide-react'
import { cn } from '@/lib/utils'

function VlanRow({ vlan }: { vlan: VlanEmbedded }) {
  const setSelectedVlan = useTopologyStore((s) => s.setSelectedVlan)
  const setSelectionVlan = useSelectionStore((s) => s.setSelectedVlan)
  const toggleDetailPanel = useUIStore((s) => s.toggleDetailPanel)
  const detailPanelOpen = useUIStore((s) => s.detailPanelOpen)
  const highlightedNodeId = useTopologyStore((s) => s.highlightedNodeId)
  const isHighlighted = highlightedNodeId === `vlan-${vlan.id}`

  const color = getVlanColor(vlan.purpose, vlan.colorIndex)

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedVlan(vlan.id)
    setSelectionVlan(vlan.id)
    if (!detailPanelOpen) toggleDetailPanel()
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer transition-all duration-150',
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
  const setSelectedSite = useSelectionStore((s) => s.setSelectedSite)
  const expandSite = useSelectionStore((s) => s.toggleExpandedSite)
  const expandedSiteIds = useSelectionStore((s) => s.expandedSiteIds)
  const toggleDetailPanel = useUIStore((s) => s.toggleDetailPanel)
  const detailPanelOpen = useUIStore((s) => s.detailPanelOpen)
  const highlightedNodeId = useTopologyStore((s) => s.highlightedNodeId)
  const isHighlighted = highlightedNodeId === id

  const handleSiteClick = () => {
    toggleExpandedSite(d.siteId)
    setSelectedSite(d.siteId)
    if (!expandedSiteIds.has(d.siteId)) expandSite(d.siteId)
    if (!detailPanelOpen) toggleDetailPanel()
  }

  return (
    <div
      className={cn(
        'rounded-xl border bg-card shadow-md transition-all duration-200',
        d.expanded ? 'min-w-[280px]' : 'min-w-[200px]',
        isHighlighted
          ? 'border-primary ring-2 ring-primary/30 shadow-lg shadow-primary/10'
          : 'border-border/60 hover:border-primary/40 hover:shadow-lg',
      )}
    >
      <Handle type="target" id="target-top" position={Position.Top} className="!w-1.5 !h-1.5 !opacity-0" />
      <Handle type="target" id="target-left" position={Position.Left} className="!w-1.5 !h-1.5 !opacity-0" />
      <Handle type="source" id="source-top" position={Position.Top} className="!w-1.5 !h-1.5 !opacity-0" />
      <Handle type="source" id="source-left" position={Position.Left} className="!w-1.5 !h-1.5 !opacity-0" />

      {/* Site header with gradient */}
      <div
        className={cn(
          'flex items-center gap-3 px-4 py-3 cursor-pointer rounded-t-xl',
          'bg-gradient-to-r from-primary/5 via-primary/3 to-transparent',
          'dark:from-primary/10 dark:via-primary/5 dark:to-transparent',
        )}
        onClick={handleSiteClick}
      >
        <div className={cn(
          'flex items-center justify-center h-8 w-8 rounded-lg shrink-0 transition-colors duration-200',
          'bg-primary/10 dark:bg-primary/20',
          isHighlighted && 'bg-primary/20 dark:bg-primary/30',
        )}>
          <Building2 className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-sm truncate">{d.label}</span>
            {d.expanded ? (
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/60 transition-transform duration-200" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60 transition-transform duration-200" />
            )}
          </div>
          <div className="flex gap-3 text-[10px] text-muted-foreground mt-0.5">
            <span className="flex items-center gap-0.5">
              <Network className="h-3 w-3" />
              {d.vlanCount}
            </span>
            <span>{d.hostCount} hosts</span>
          </div>
        </div>
      </div>

      {/* WAN Addresses — always visible */}
      {d.wanAddresses.length > 0 && (
        <div className="px-4 pb-1.5 pt-0.5 space-y-0.5">
          {d.wanAddresses.map((wan, i) => (
            <div key={i} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <Globe className="h-3 w-3 shrink-0 text-sky-500/70" />
              <span className="font-mono">{wan.ip_address}</span>
              <span className="text-[9px] opacity-60">{wan.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Expanded VLANs */}
      {d.expanded && d.vlans.length > 0 && (
        <div className="px-3 pb-3 space-y-1 border-t border-border/30 pt-2 mt-0.5">
          {d.vlans.map((vlan) => (
            <VlanRow key={vlan.id} vlan={vlan} />
          ))}
        </div>
      )}

      <Handle type="target" id="target-bottom" position={Position.Bottom} className="!w-1.5 !h-1.5 !opacity-0" />
      <Handle type="target" id="target-right" position={Position.Right} className="!w-1.5 !h-1.5 !opacity-0" />
      <Handle type="source" id="source-bottom" position={Position.Bottom} className="!w-1.5 !h-1.5 !opacity-0" />
      <Handle type="source" id="source-right" position={Position.Right} className="!w-1.5 !h-1.5 !opacity-0" />
    </div>
  )
})
