import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import type { SiteNodeData } from '@/lib/topology.utils'
import { useTopologyStore } from '@/stores/topology.store'
import { Building2, ChevronDown, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export const SiteNode = memo(function SiteNode({ data, id }: NodeProps) {
  const d = data as SiteNodeData
  const toggleExpandedSite = useTopologyStore((s) => s.toggleExpandedSite)
  const highlightedNodeId = useTopologyStore((s) => s.highlightedNodeId)
  const isHighlighted = highlightedNodeId === id

  return (
    <div
      className={cn(
        'rounded-lg border-2 bg-card shadow-md px-4 py-3 min-w-[180px] cursor-pointer transition-all',
        isHighlighted
          ? 'border-primary ring-2 ring-primary/30 shadow-lg'
          : 'border-border hover:border-primary/50',
      )}
      onClick={() => toggleExpandedSite(d.siteId)}
    >
      <Handle type="target" position={Position.Top} className="!bg-primary !w-2 !h-2" />

      <div className="flex items-center gap-2">
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
            <span>{d.vlanCount} VLANs</span>
            <span>{d.hostCount} hosts</span>
          </div>
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-primary !w-2 !h-2" />
    </div>
  )
})
