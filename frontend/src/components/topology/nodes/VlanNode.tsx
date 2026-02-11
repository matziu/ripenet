import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import type { VlanNodeData } from '@/lib/topology.utils'
import { useTopologyStore } from '@/stores/topology.store'
import { useUIStore } from '@/stores/ui.store'
import { Globe } from 'lucide-react'
import { cn } from '@/lib/utils'

export const VlanNode = memo(function VlanNode({ data, id }: NodeProps) {
  const d = data as VlanNodeData
  const setSelectedVlan = useTopologyStore((s) => s.setSelectedVlan)
  const toggleDetailPanel = useUIStore((s) => s.toggleDetailPanel)
  const detailPanelOpen = useUIStore((s) => s.detailPanelOpen)
  const highlightedNodeId = useTopologyStore((s) => s.highlightedNodeId)
  const isHighlighted = highlightedNodeId === id

  const handleClick = () => {
    setSelectedVlan(d.vlanId)
    if (!detailPanelOpen) toggleDetailPanel()
  }

  return (
    <div
      className={cn(
        'rounded-md border bg-card shadow-sm px-3 py-2 min-w-[140px] cursor-pointer transition-all',
        isHighlighted
          ? 'border-primary ring-2 ring-primary/30'
          : 'border-border hover:border-primary/50',
      )}
      onClick={handleClick}
    >
      <Handle type="target" position={Position.Top} className="!bg-blue-400 !w-1.5 !h-1.5" />

      <div className="flex items-center gap-2">
        <Globe className="h-4 w-4 text-blue-500 shrink-0" />
        <div className="min-w-0">
          <p className="text-xs font-medium truncate">{d.label}</p>
          <p className="text-[10px] text-muted-foreground truncate">{d.name}</p>
          <p className="text-[10px] text-muted-foreground">{d.hostCount} hosts</p>
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-blue-400 !w-1.5 !h-1.5" />
    </div>
  )
})
