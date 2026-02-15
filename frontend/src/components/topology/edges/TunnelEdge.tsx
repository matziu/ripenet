import { useMemo } from 'react'
import { BaseEdge, getBezierPath, EdgeLabelRenderer } from '@xyflow/react'
import type { EdgeProps } from '@xyflow/react'
import type { TunnelEdgeData } from '@/lib/topology.utils'


const tunnelTypeColors: Record<string, string> = {
  wireguard: '#8b5cf6',
  ipsec: '#f59e0b',
  gre: '#3b82f6',
  vxlan: '#06b6d4',
}

function getEnabledStyle(enabled: boolean): { dasharray?: string; opacity: number; animate: boolean } {
  return enabled
    ? { dasharray: '8 4', opacity: 1, animate: true }
    : { dasharray: '8 4', opacity: 0.35, animate: false }
}

const PERPENDICULAR_OFFSET = 18

/** Get a point at a fraction along an SVG path, plus a perpendicular offset. */
function getPointOnPath(
  pathString: string,
  fraction: number,
  offsetPx: number,
): { x: number; y: number } {
  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
  path.setAttribute('d', pathString)
  const totalLen = path.getTotalLength()
  const pt = path.getPointAtLength(totalLen * fraction)

  if (offsetPx === 0) return { x: pt.x, y: pt.y }

  // Get tangent direction from a small delta
  const delta = Math.min(1, totalLen * 0.001)
  const ptA = path.getPointAtLength(Math.max(0, totalLen * fraction - delta))
  const ptB = path.getPointAtLength(Math.min(totalLen, totalLen * fraction + delta))
  const dx = ptB.x - ptA.x
  const dy = ptB.y - ptA.y
  const len = Math.sqrt(dx * dx + dy * dy)
  if (len === 0) return { x: pt.x, y: pt.y }

  // Perpendicular normal (rotated 90 degrees)
  const nx = -dy / len
  const ny = dx / len

  return { x: pt.x + nx * offsetPx, y: pt.y + ny * offsetPx }
}

export function TunnelEdge({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, id, markerEnd, markerStart }: EdgeProps) {
  const d = data as TunnelEdgeData

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, targetX, targetY,
    sourcePosition, targetPosition,
  })

  const baseColor = tunnelTypeColors[d.tunnelType] ?? '#94a3b8'
  const color = d.enabled ? baseColor : '#94a3b8'
  const status = getEnabledStyle(d.enabled)

  // offsetSide from layout: +1 or -1, pushes labels away from graph centroid
  const side = (d.offsetSide as number) ?? 1
  const offset = side * PERPENDICULAR_OFFSET

  // Compute IP label positions on the actual Bezier curve.
  const { ipAPos, ipBPos } = useMemo(() => {
    if (!edgePath) return { ipAPos: null, ipBPos: null }
    try {
      return {
        ipAPos: getPointOnPath(edgePath, 0.12, offset),
        ipBPos: getPointOnPath(edgePath, 0.88, offset),
      }
    } catch {
      const dx = targetX - sourceX
      const dy = targetY - sourceY
      const len = Math.sqrt(dx * dx + dy * dy) || 1
      const nx = (-dy / len) * offset
      const ny = (dx / len) * offset
      return {
        ipAPos: {
          x: sourceX + dx * 0.12 + nx,
          y: sourceY + dy * 0.12 + ny,
        },
        ipBPos: {
          x: sourceX + dx * 0.88 + nx,
          y: sourceY + dy * 0.88 + ny,
        },
      }
    }
  }, [edgePath, sourceX, sourceY, targetX, targetY, offset])

  return (
    <>
      {/* Glow layer for active tunnels */}
      {status.animate && (
        <BaseEdge
          id={`${id}-glow`}
          path={edgePath}
          style={{
            stroke: color,
            strokeWidth: 6,
            opacity: 0.15,
            filter: 'blur(3px)',
          }}
        />
      )}
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        markerStart={markerStart}
        style={{
          stroke: color,
          strokeWidth: 2,
          strokeDasharray: status.dasharray,
          opacity: status.opacity,
        }}
      />
      {/* Animated flow overlay for active tunnels */}
      {status.animate && (
        <BaseEdge
          id={`${id}-flow`}
          path={edgePath}
          style={{
            stroke: color,
            strokeWidth: 2,
            strokeDasharray: '4 8',
            opacity: 0.6,
            animation: 'dash-flow 1.5s linear infinite',
          }}
        />
      )}
      <EdgeLabelRenderer>
        {/* Center label: subnet + type */}
        <div
          className="absolute rounded-md border bg-card/95 backdrop-blur-sm px-2 py-0.5 text-[10px] font-mono shadow-sm pointer-events-all"
          style={{
            borderColor: color,
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
          }}
        >
          <span>{d.label}</span>
          <span className="ml-1.5 text-muted-foreground uppercase text-[9px]">{d.tunnelType}</span>
          {!d.enabled && (
            <span className="ml-1.5 text-muted-foreground text-[9px] font-semibold">OFF</span>
          )}
        </div>

        {/* IP at source end (site A) */}
        {d.ipA && ipAPos && (
          <div
            className="absolute rounded bg-card/90 backdrop-blur-sm px-1 py-0.5 text-[9px] font-mono text-muted-foreground border shadow-sm"
            style={{
              borderColor: `${color}60`,
              transform: `translate(-50%, -50%) translate(${ipAPos.x}px,${ipAPos.y}px)`,
            }}
          >
            {d.ipA}
          </div>
        )}

        {/* IP at target end (site B) */}
        {d.ipB && ipBPos && (
          <div
            className="absolute rounded bg-card/90 backdrop-blur-sm px-1 py-0.5 text-[9px] font-mono text-muted-foreground border shadow-sm"
            style={{
              borderColor: `${color}60`,
              transform: `translate(-50%, -50%) translate(${ipBPos.x}px,${ipBPos.y}px)`,
            }}
          >
            {d.ipB}
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  )
}
