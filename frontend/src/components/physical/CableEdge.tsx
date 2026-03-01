import { BaseEdge, EdgeLabelRenderer, Position } from '@xyflow/react'
import type { EdgeProps } from '@xyflow/react'
import { useSelectionStore } from '@/stores/selection.store'
import { useUIStore } from '@/stores/ui.store'
import type { PhysicalCable } from '@/types'

export interface CableEdgeData extends PhysicalCable {
  [key: string]: unknown
}

const cableTypeColors: Record<string, string> = {
  fiber_sm: '#eab308',
  fiber_mm: '#f97316',
  cat6: '#3b82f6',
  cat5e: '#9ca3af',
  cat6a: '#14b8a6',
  dac: '#22c55e',
}

function getCableColor(cableType: string): string {
  return cableTypeColors[cableType] ?? '#64748b'
}

export function CableEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
  markerStart,
}: EdgeProps) {
  const d = data as CableEdgeData
  const setSelectedCable = useSelectionStore((s) => s.setSelectedCable)
  const toggleDetailPanel = useUIStore((s) => s.toggleDetailPanel)
  const detailPanelOpen = useUIStore((s) => s.detailPanelOpen)

  // Always build cable path that exits from the port handle direction first,
  // then curves to the target. This guarantees the cable visually starts/ends
  // at the port dot, never at a node edge.
  const MIN_EXTEND = 40
  const isSameNode = !!(d as CableEdgeData & { _sameNode?: boolean })._sameNode

  const sourceDir = sourcePosition === Position.Left ? -1 : 1
  const targetDir = targetPosition === Position.Left ? -1 : 1

  // Control point extends from the handle in its direction by at least MIN_EXTEND
  const dist = Math.sqrt((targetX - sourceX) ** 2 + (targetY - sourceY) ** 2) || 1
  // For same-node (PP-to-PP loopback), extend much further so the loop is clearly visible
  const extend = isSameNode ? Math.max(80, dist * 0.5 + 60) : Math.max(MIN_EXTEND, dist * 0.3)

  const cp1x = sourceX + sourceDir * extend
  const cp1y = sourceY
  const cp2x = targetX + targetDir * extend
  const cp2y = targetY

  const edgePath = `M ${sourceX},${sourceY} C ${cp1x},${cp1y} ${cp2x},${cp2y} ${targetX},${targetY}`
  const labelX = (sourceX + targetX + cp1x + cp2x) / 4
  const labelY = (sourceY + targetY + cp1y + cp2y) / 4

  const color = getCableColor(d.cable_type)
  const displayLabel = d.label || d.cable_type

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedCable(d.id)
    if (!detailPanelOpen) toggleDetailPanel()
  }

  return (
    <>
      {/* Background halo — creates a visible gap at crossings (like electrical schematics) */}
      <path
        d={edgePath}
        fill="none"
        className="stroke-background"
        strokeWidth={10}
        strokeLinecap="round"
      />
      {/* Wider invisible path for easier click targeting */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={14}
        className="cursor-pointer"
        onClick={handleClick}
      />
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        markerStart={markerStart}
        style={{
          stroke: color,
          strokeWidth: 2.5,
        }}
      />
      <EdgeLabelRenderer>
        <div
          className="absolute rounded-md border bg-card/95 backdrop-blur-sm px-1.5 py-0.5 text-[9px] font-mono shadow-sm pointer-events-auto cursor-pointer"
          style={{
            borderColor: `${color}80`,
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
          }}
          onClick={handleClick}
        >
          <span style={{ color }}>{displayLabel}</span>
        </div>
      </EdgeLabelRenderer>
    </>
  )
}

export { cableTypeColors, getCableColor }
