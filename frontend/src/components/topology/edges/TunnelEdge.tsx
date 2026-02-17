import { useMemo } from 'react'
import { BaseEdge, getBezierPath, EdgeLabelRenderer, Position, useInternalNode } from '@xyflow/react'
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

// --- Floating edge helpers ---

/** Find where a line from node center to a target point intersects the node's boundary rectangle. */
function getNodeIntersection(
  node: { x: number; y: number; width: number; height: number },
  targetPoint: { x: number; y: number },
): { x: number; y: number } {
  const w = node.width / 2
  const h = node.height / 2
  const cx = node.x + w
  const cy = node.y + h

  const dx = targetPoint.x - cx
  const dy = targetPoint.y - cy

  if (dx === 0 && dy === 0) return { x: cx, y: cy }

  // Determine which edge the line intersects by comparing slopes
  const absDx = Math.abs(dx)
  const absDy = Math.abs(dy)

  // If the aspect ratio of the direction is wider than the box, hit left/right edge
  if (absDx * h > absDy * w) {
    // Left or right edge
    const signX = dx > 0 ? 1 : -1
    return {
      x: cx + signX * w,
      y: cy + (dy * w) / absDx,
    }
  } else {
    // Top or bottom edge
    const signY = dy > 0 ? 1 : -1
    return {
      x: cx + (dx * h) / absDy,
      y: cy + signY * h,
    }
  }
}

/** Determine which Position (Top/Right/Bottom/Left) a point is on relative to a node. */
function getEdgePosition(
  node: { x: number; y: number; width: number; height: number },
  point: { x: number; y: number },
): Position {
  const cx = node.x + node.width / 2
  const cy = node.y + node.height / 2
  const dx = point.x - cx
  const dy = point.y - cy

  // Compare which axis is dominant
  if (Math.abs(dx) > Math.abs(dy)) {
    return dx > 0 ? Position.Right : Position.Left
  }
  return dy > 0 ? Position.Bottom : Position.Top
}

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

  const delta = Math.min(1, totalLen * 0.001)
  const ptA = path.getPointAtLength(Math.max(0, totalLen * fraction - delta))
  const ptB = path.getPointAtLength(Math.min(totalLen, totalLen * fraction + delta))
  const dx = ptB.x - ptA.x
  const dy = ptB.y - ptA.y
  const len = Math.sqrt(dx * dx + dy * dy)
  if (len === 0) return { x: pt.x, y: pt.y }

  const nx = -dy / len
  const ny = dx / len
  return { x: pt.x + nx * offsetPx, y: pt.y + ny * offsetPx }
}

export function TunnelEdge({ source, target, data, id, markerEnd, markerStart }: EdgeProps) {
  const d = data as TunnelEdgeData

  // Access real-time node positions (updates during drag!)
  const sourceNode = useInternalNode(source)
  const targetNode = useInternalNode(target)

  // Compute floating edge connection points
  const { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition } = useMemo(() => {
    if (!sourceNode || !targetNode) {
      return { sourceX: 0, sourceY: 0, targetX: 0, targetY: 0, sourcePosition: Position.Right, targetPosition: Position.Left }
    }

    const sRect = {
      x: sourceNode.internals.positionAbsolute.x,
      y: sourceNode.internals.positionAbsolute.y,
      width: sourceNode.measured.width ?? 260,
      height: sourceNode.measured.height ?? 80,
    }
    const tRect = {
      x: targetNode.internals.positionAbsolute.x,
      y: targetNode.internals.positionAbsolute.y,
      width: targetNode.measured.width ?? 260,
      height: targetNode.measured.height ?? 80,
    }

    const sCx = sRect.x + sRect.width / 2
    const sCy = sRect.y + sRect.height / 2
    const tCx = tRect.x + tRect.width / 2
    const tCy = tRect.y + tRect.height / 2

    const sIntersection = getNodeIntersection(sRect, { x: tCx, y: tCy })
    const tIntersection = getNodeIntersection(tRect, { x: sCx, y: sCy })

    return {
      sourceX: sIntersection.x,
      sourceY: sIntersection.y,
      targetX: tIntersection.x,
      targetY: tIntersection.y,
      sourcePosition: getEdgePosition(sRect, sIntersection),
      targetPosition: getEdgePosition(tRect, tIntersection),
    }
  }, [sourceNode, targetNode])

  if (!sourceNode || !targetNode) return null

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, targetX, targetY,
    sourcePosition, targetPosition,
  })

  const isExternal = !!d.externalEndpoint
  const isCrossProject = !!d.crossProjectName
  const baseColor = isExternal ? '#f97316' : isCrossProject ? '#f59e0b' : (tunnelTypeColors[d.tunnelType] ?? '#94a3b8')
  const color = d.enabled ? baseColor : '#94a3b8'
  const status = getEnabledStyle(d.enabled)
  const dashArray = isExternal ? '4 4 1 4' : isCrossProject ? '12 4' : status.dasharray

  // Compute offset direction: push labels away from graph midpoint
  const side = (d.offsetSide as number) ?? 1
  const offset = side * PERPENDICULAR_OFFSET

  // Compute IP label positions on the actual Bezier curve
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
        ipAPos: { x: sourceX + dx * 0.12 + nx, y: sourceY + dy * 0.12 + ny },
        ipBPos: { x: sourceX + dx * 0.88 + nx, y: sourceY + dy * 0.88 + ny },
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
          strokeWidth: isExternal || isCrossProject ? 2.5 : 2,
          strokeDasharray: dashArray,
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
          {isExternal && (
            <span className="ml-1.5 text-[8px] font-bold uppercase" style={{ color: '#f97316' }}>EXT</span>
          )}
          {isCrossProject && (
            <span className="ml-1.5 text-[8px] font-bold uppercase" style={{ color: '#f59e0b' }}>XP</span>
          )}
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
