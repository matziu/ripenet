import { BaseEdge, getBezierPath, EdgeLabelRenderer } from '@xyflow/react'
import type { EdgeProps } from '@xyflow/react'
import type { TunnelEdgeData } from '@/lib/topology.utils'
import { cn } from '@/lib/utils'

const statusColors: Record<string, string> = {
  active: '#22c55e',
  planned: '#3b82f6',
  down: '#ef4444',
}

export function TunnelEdge(props: EdgeProps) {
  const { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data } = props
  const d = data as TunnelEdgeData

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, targetX, targetY,
    sourcePosition, targetPosition,
  })

  const color = statusColors[d.status] ?? '#94a3b8'

  return (
    <>
      <BaseEdge
        {...props}
        path={edgePath}
        style={{ stroke: color, strokeWidth: 2 }}
      />
      <EdgeLabelRenderer>
        <div
          className={cn(
            'absolute rounded border bg-card px-1.5 py-0.5 text-[10px] font-mono shadow-sm pointer-events-all',
            d.status === 'active' ? 'border-green-300' : 'border-border',
          )}
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
          }}
        >
          <span>{d.label}</span>
          <span className="ml-1 text-muted-foreground uppercase">{d.tunnelType}</span>
        </div>
      </EdgeLabelRenderer>
    </>
  )
}
