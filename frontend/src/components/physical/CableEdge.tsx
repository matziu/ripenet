import { BaseEdge, getBezierPath, EdgeLabelRenderer } from '@xyflow/react'
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

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  })

  const color = getCableColor(d.cable_type)
  const displayLabel = d.label || d.cable_type

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedCable(d.id)
    if (!detailPanelOpen) toggleDetailPanel()
  }

  return (
    <>
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
          opacity: 0.85,
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
