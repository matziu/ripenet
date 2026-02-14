import dagre from 'dagre'
import type { Node, Edge } from '@xyflow/react'
import type { ProjectTopology, VLANTopology } from '@/types'

// Color palette for VLANs by purpose
const VLAN_PURPOSE_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  management: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/40', text: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500' },
  'user workstations': { bg: 'bg-blue-500/10', border: 'border-blue-500/40', text: 'text-blue-700 dark:text-blue-400', dot: 'bg-blue-500' },
  'server farm': { bg: 'bg-violet-500/10', border: 'border-violet-500/40', text: 'text-violet-700 dark:text-violet-400', dot: 'bg-violet-500' },
  voip: { bg: 'bg-amber-500/10', border: 'border-amber-500/40', text: 'text-amber-700 dark:text-amber-400', dot: 'bg-amber-500' },
  guest: { bg: 'bg-rose-500/10', border: 'border-rose-500/40', text: 'text-rose-700 dark:text-rose-400', dot: 'bg-rose-500' },
  iot: { bg: 'bg-cyan-500/10', border: 'border-cyan-500/40', text: 'text-cyan-700 dark:text-cyan-400', dot: 'bg-cyan-500' },
  dmz: { bg: 'bg-orange-500/10', border: 'border-orange-500/40', text: 'text-orange-700 dark:text-orange-400', dot: 'bg-orange-500' },
}

// Fallback colors by index for unmapped purposes — 30 distinct colors
const VLAN_INDEX_COLORS = [
  { bg: 'bg-emerald-500/10', border: 'border-emerald-500/40', text: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500' },
  { bg: 'bg-blue-500/10', border: 'border-blue-500/40', text: 'text-blue-700 dark:text-blue-400', dot: 'bg-blue-500' },
  { bg: 'bg-violet-500/10', border: 'border-violet-500/40', text: 'text-violet-700 dark:text-violet-400', dot: 'bg-violet-500' },
  { bg: 'bg-amber-500/10', border: 'border-amber-500/40', text: 'text-amber-700 dark:text-amber-400', dot: 'bg-amber-500' },
  { bg: 'bg-rose-500/10', border: 'border-rose-500/40', text: 'text-rose-700 dark:text-rose-400', dot: 'bg-rose-500' },
  { bg: 'bg-cyan-500/10', border: 'border-cyan-500/40', text: 'text-cyan-700 dark:text-cyan-400', dot: 'bg-cyan-500' },
  { bg: 'bg-orange-500/10', border: 'border-orange-500/40', text: 'text-orange-700 dark:text-orange-400', dot: 'bg-orange-500' },
  { bg: 'bg-teal-500/10', border: 'border-teal-500/40', text: 'text-teal-700 dark:text-teal-400', dot: 'bg-teal-500' },
  { bg: 'bg-pink-500/10', border: 'border-pink-500/40', text: 'text-pink-700 dark:text-pink-400', dot: 'bg-pink-500' },
  { bg: 'bg-indigo-500/10', border: 'border-indigo-500/40', text: 'text-indigo-700 dark:text-indigo-400', dot: 'bg-indigo-500' },
  { bg: 'bg-lime-500/10', border: 'border-lime-500/40', text: 'text-lime-700 dark:text-lime-400', dot: 'bg-lime-500' },
  { bg: 'bg-fuchsia-500/10', border: 'border-fuchsia-500/40', text: 'text-fuchsia-700 dark:text-fuchsia-400', dot: 'bg-fuchsia-500' },
  { bg: 'bg-sky-500/10', border: 'border-sky-500/40', text: 'text-sky-700 dark:text-sky-400', dot: 'bg-sky-500' },
  { bg: 'bg-yellow-500/10', border: 'border-yellow-500/40', text: 'text-yellow-700 dark:text-yellow-400', dot: 'bg-yellow-500' },
  { bg: 'bg-purple-500/10', border: 'border-purple-500/40', text: 'text-purple-700 dark:text-purple-400', dot: 'bg-purple-500' },
  { bg: 'bg-red-500/10', border: 'border-red-500/40', text: 'text-red-700 dark:text-red-400', dot: 'bg-red-500' },
  { bg: 'bg-green-500/10', border: 'border-green-500/40', text: 'text-green-700 dark:text-green-400', dot: 'bg-green-500' },
  { bg: 'bg-stone-500/10', border: 'border-stone-500/40', text: 'text-stone-700 dark:text-stone-400', dot: 'bg-stone-500' },
  { bg: 'bg-emerald-400/10', border: 'border-emerald-400/40', text: 'text-emerald-600 dark:text-emerald-300', dot: 'bg-emerald-400' },
  { bg: 'bg-blue-400/10', border: 'border-blue-400/40', text: 'text-blue-600 dark:text-blue-300', dot: 'bg-blue-400' },
  { bg: 'bg-violet-400/10', border: 'border-violet-400/40', text: 'text-violet-600 dark:text-violet-300', dot: 'bg-violet-400' },
  { bg: 'bg-amber-400/10', border: 'border-amber-400/40', text: 'text-amber-600 dark:text-amber-300', dot: 'bg-amber-400' },
  { bg: 'bg-rose-400/10', border: 'border-rose-400/40', text: 'text-rose-600 dark:text-rose-300', dot: 'bg-rose-400' },
  { bg: 'bg-cyan-400/10', border: 'border-cyan-400/40', text: 'text-cyan-600 dark:text-cyan-300', dot: 'bg-cyan-400' },
  { bg: 'bg-orange-400/10', border: 'border-orange-400/40', text: 'text-orange-600 dark:text-orange-300', dot: 'bg-orange-400' },
  { bg: 'bg-teal-400/10', border: 'border-teal-400/40', text: 'text-teal-600 dark:text-teal-300', dot: 'bg-teal-400' },
  { bg: 'bg-pink-400/10', border: 'border-pink-400/40', text: 'text-pink-600 dark:text-pink-300', dot: 'bg-pink-400' },
  { bg: 'bg-indigo-400/10', border: 'border-indigo-400/40', text: 'text-indigo-600 dark:text-indigo-300', dot: 'bg-indigo-400' },
  { bg: 'bg-lime-400/10', border: 'border-lime-400/40', text: 'text-lime-600 dark:text-lime-300', dot: 'bg-lime-400' },
  { bg: 'bg-fuchsia-400/10', border: 'border-fuchsia-400/40', text: 'text-fuchsia-600 dark:text-fuchsia-300', dot: 'bg-fuchsia-400' },
]

export function getVlanColor(purpose: string, index: number) {
  const key = purpose.toLowerCase()
  return VLAN_PURPOSE_COLORS[key] ?? VLAN_INDEX_COLORS[index % VLAN_INDEX_COLORS.length]
}

export interface VlanEmbedded {
  id: number
  vlanId: number
  name: string
  purpose: string
  subnets: string[]
  hostCount: number
  colorIndex: number
}

export interface SiteNodeData {
  label: string
  address: string
  vlanCount: number
  hostCount: number
  siteId: number
  expanded: boolean
  vlans: VlanEmbedded[]
  wanAddresses: { ip_address: string; label: string }[]
  [key: string]: unknown
}

export interface TunnelEdgeData {
  label: string
  tunnelType: string
  status: string
  ipA: string
  ipB: string
  offsetSide: number
  [key: string]: unknown
}

const SITE_WIDTH_COLLAPSED = 200
const SITE_HEIGHT_COLLAPSED = 80
const SITE_WIDTH_EXPANDED = 280
const VLAN_ROW_HEIGHT = 36
const SITE_EXPANDED_PADDING = 80

const WAN_ROW_HEIGHT = 18

function getSiteSize(expanded: boolean, vlanCount: number, wanCount = 0) {
  const wanExtra = wanCount * WAN_ROW_HEIGHT
  if (!expanded) return { w: SITE_WIDTH_COLLAPSED, h: SITE_HEIGHT_COLLAPSED + wanExtra }
  return {
    w: SITE_WIDTH_EXPANDED,
    h: SITE_EXPANDED_PADDING + vlanCount * VLAN_ROW_HEIGHT + wanExtra,
  }
}

function vlansToEmbedded(vlans: VLANTopology[]): VlanEmbedded[] {
  return vlans.map((vlan, i) => ({
    id: vlan.id,
    vlanId: vlan.vlan_id,
    name: vlan.name,
    purpose: vlan.purpose,
    subnets: vlan.subnets.map((s) => s.network),
    hostCount: vlan.subnets.reduce((sum, s) => sum + s.hosts.length, 0),
    colorIndex: i,
  }))
}

// --- Layout analysis ---

type LayoutStrategy = 'polygon' | 'dagre'

function analyzeTopology(nodes: Node[], edges: Edge[]): LayoutStrategy {
  const n = nodes.length
  if (n <= 1) return 'dagre'
  if (n > 5) return 'dagre'

  // Check for full mesh: every pair of nodes is connected
  const fullMeshEdgeCount = (n * (n - 1)) / 2
  if (edges.length === fullMeshEdgeCount) {
    const nodeIds = new Set(nodes.map((node) => node.id))
    const connectedPairs = new Set<string>()
    for (const edge of edges) {
      if (nodeIds.has(edge.source) && nodeIds.has(edge.target)) {
        const pair = [edge.source, edge.target].sort().join('|')
        connectedPairs.add(pair)
      }
    }
    if (connectedPairs.size === fullMeshEdgeCount) return 'polygon'
  }

  return 'dagre'
}

function applyPolygonLayout(
  nodes: Node[],
  edges: Edge[],
): { nodes: Node[]; edges: Edge[] } {
  const n = nodes.length

  // Special case: 2 nodes → place side by side
  if (n === 2) {
    const sizes = nodes.map((node) => {
      const d = node.data as SiteNodeData
      return getSiteSize(d.expanded, d.vlans.length, d.wanAddresses?.length ?? 0)
    })
    const layoutedNodes = nodes.map((node, i) => ({
      ...node,
      position: { x: i * (sizes[i].w + 250), y: 0 },
    }))
    return { nodes: layoutedNodes, edges: assignHandles(layoutedNodes, edges) }
  }

  // Find max node size for radius calculation
  let maxDim = 0
  for (const node of nodes) {
    const d = node.data as SiteNodeData
    const { w, h } = getSiteSize(d.expanded, d.vlans.length, d.wanAddresses?.length ?? 0)
    maxDim = Math.max(maxDim, w, h)
  }

  const radius = Math.max(250, maxDim * 1.8)
  const startAngle = -Math.PI / 2 // Start from top

  const layoutedNodes = nodes.map((node, i) => {
    const d = node.data as SiteNodeData
    const { w, h } = getSiteSize(d.expanded, d.vlans.length, d.wanAddresses?.length ?? 0)
    const angle = startAngle + (2 * Math.PI * i) / n
    return {
      ...node,
      position: {
        x: Math.cos(angle) * radius - w / 2,
        y: Math.sin(angle) * radius - h / 2,
      },
    }
  })

  return { nodes: layoutedNodes, edges: assignHandles(layoutedNodes, edges) }
}

/** Check if any node bounding boxes overlap (with padding). */
export function hasOverlaps(nodes: Node[], padding = 30): boolean {
  const boxes = nodes.map((node) => {
    const d = node.data as SiteNodeData
    const { w, h } = getSiteSize(d.expanded, d.vlans.length, d.wanAddresses?.length ?? 0)
    return {
      left: node.position.x - padding,
      right: node.position.x + w + padding,
      top: node.position.y - padding,
      bottom: node.position.y + h + padding,
    }
  })

  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]
      const b = boxes[j]
      if (a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top) {
        return true
      }
    }
  }
  return false
}

// --- Handle & label offset assignment ---

/** Angular distance between two angles in radians, result in [0, π]. */
function angleDist(a: number, b: number): number {
  let d = b - a
  d = ((d % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI) - Math.PI
  return Math.abs(d)
}

const HANDLE_DIRECTIONS: Array<{ suffix: string; angle: number }> = [
  { suffix: 'right', angle: 0 },
  { suffix: 'bottom', angle: Math.PI / 2 },
  { suffix: 'left', angle: Math.PI },
  { suffix: 'top', angle: -Math.PI / 2 },
]

/**
 * Assign sourceHandle/targetHandle per edge + offsetSide for label placement.
 *
 * 1. For each node, collect all edges with their angle to the peer node.
 * 2. Sort by angle, then greedily assign the closest AVAILABLE handle
 *    so that no two edges at the same node share a handle.
 * 3. Compute offsetSide (+1 or -1) per edge so IP labels are pushed
 *    away from the graph centroid — ensures symmetric, non-overlapping labels.
 */
function assignHandles(nodes: Node[], edges: Edge[]): Edge[] {
  // 1. Compute node centers
  const centerMap = new Map<string, { cx: number; cy: number }>()
  for (const node of nodes) {
    const d = node.data as SiteNodeData
    const { w, h } = getSiteSize(d.expanded, d.vlans.length, d.wanAddresses?.length ?? 0)
    centerMap.set(node.id, {
      cx: node.position.x + w / 2,
      cy: node.position.y + h / 2,
    })
  }

  // 2. Graph centroid
  let centroidX = 0
  let centroidY = 0
  for (const c of centerMap.values()) {
    centroidX += c.cx
    centroidY += c.cy
  }
  centroidX /= centerMap.size
  centroidY /= centerMap.size

  // 3. For each node, collect edges arriving/departing with their angle
  interface EdgeAtNode {
    edgeIndex: number
    angle: number
    role: 'source' | 'target'
  }
  const nodeEdgeMap = new Map<string, EdgeAtNode[]>()

  edges.forEach((edge, i) => {
    const src = centerMap.get(edge.source)
    const tgt = centerMap.get(edge.target)
    if (!src || !tgt) return

    // Angle from source toward target
    const fwdAngle = Math.atan2(tgt.cy - src.cy, tgt.cx - src.cx)

    if (!nodeEdgeMap.has(edge.source)) nodeEdgeMap.set(edge.source, [])
    nodeEdgeMap.get(edge.source)!.push({ edgeIndex: i, angle: fwdAngle, role: 'source' })

    // Angle from target toward source (reverse)
    const revAngle = Math.atan2(src.cy - tgt.cy, src.cx - tgt.cx)

    if (!nodeEdgeMap.has(edge.target)) nodeEdgeMap.set(edge.target, [])
    nodeEdgeMap.get(edge.target)!.push({ edgeIndex: i, angle: revAngle, role: 'target' })
  })

  // 4. Per-node greedy handle assignment
  const edgeHandles: Array<{ sourceHandle?: string; targetHandle?: string }> =
    edges.map(() => ({}))

  for (const [, edgesAtNode] of nodeEdgeMap) {
    // Sort by angle so we assign in angular order
    edgesAtNode.sort((a, b) => a.angle - b.angle)

    const usedSuffixes = new Set<string>()

    for (const entry of edgesAtNode) {
      // Find the closest available handle direction
      const candidates = HANDLE_DIRECTIONS
        .filter((h) => !usedSuffixes.has(h.suffix))
        .sort((a, b) => angleDist(entry.angle, a.angle) - angleDist(entry.angle, b.angle))

      // Fallback: if all 4 taken, pick absolute closest (will share)
      const best = candidates[0] ?? HANDLE_DIRECTIONS
        .slice()
        .sort((a, b) => angleDist(entry.angle, a.angle) - angleDist(entry.angle, b.angle))[0]

      usedSuffixes.add(best.suffix)

      const handleId = `${entry.role}-${best.suffix}`
      if (entry.role === 'source') {
        edgeHandles[entry.edgeIndex].sourceHandle = handleId
      } else {
        edgeHandles[entry.edgeIndex].targetHandle = handleId
      }
    }
  }

  // 5. Per-edge offsetSide: push labels away from graph centroid
  return edges.map((edge, i) => {
    const src = centerMap.get(edge.source)
    const tgt = centerMap.get(edge.target)

    let offsetSide = 1
    if (src && tgt) {
      const edgeMidX = (src.cx + tgt.cx) / 2
      const edgeMidY = (src.cy + tgt.cy) / 2
      const dx = tgt.cx - src.cx
      const dy = tgt.cy - src.cy
      const len = Math.sqrt(dx * dx + dy * dy) || 1

      // Perpendicular normal (−dy, dx) / len
      const nx = -dy / len
      const ny = dx / len

      // Does the perpendicular point away from centroid?
      const toMidX = edgeMidX - centroidX
      const toMidY = edgeMidY - centroidY
      const dot = nx * toMidX + ny * toMidY
      offsetSide = dot >= 0 ? 1 : -1
    }

    return {
      ...edge,
      sourceHandle: edgeHandles[i].sourceHandle ?? edge.sourceHandle,
      targetHandle: edgeHandles[i].targetHandle ?? edge.targetHandle,
      data: {
        ...edge.data,
        offsetSide,
      },
    }
  })
}

function applyDagreLayout(
  nodes: Node[],
  edges: Edge[],
): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({
    rankdir: 'LR',
    nodesep: 150,
    ranksep: 250,
    edgesep: 30,
  })

  nodes.forEach((node) => {
    const d = node.data as SiteNodeData
    const { w, h } = getSiteSize(d.expanded, d.vlans.length, d.wanAddresses?.length ?? 0)
    g.setNode(node.id, { width: w + 40, height: h + 40 })
  })

  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target, { minlen: 2 })
  })

  dagre.layout(g)

  const layoutedNodes = nodes.map((node) => {
    const n = g.node(node.id)
    const d = node.data as SiteNodeData
    const { w, h } = getSiteSize(d.expanded, d.vlans.length, d.wanAddresses?.length ?? 0)
    return {
      ...node,
      position: { x: n.x - w / 2, y: n.y - h / 2 },
    }
  })

  return { nodes: layoutedNodes, edges: assignHandles(layoutedNodes, edges) }
}

export function topologyToFlow(
  topology: ProjectTopology,
  expandedSites: Set<number>,
  savedPositions?: Record<string, { x: number; y: number }>,
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = []
  const edges: Edge[] = []

  topology.sites.forEach((site) => {
    const totalHosts = site.vlans.reduce(
      (sum, v) => sum + v.subnets.reduce((s, sub) => s + sub.hosts.length, 0),
      0,
    )
    const isExpanded = expandedSites.has(site.id)

    nodes.push({
      id: `site-${site.id}`,
      type: 'siteNode',
      position: savedPositions?.[`site-${site.id}`] ?? { x: 0, y: 0 },
      data: {
        label: site.name,
        address: site.address,
        vlanCount: site.vlans.length,
        hostCount: totalHosts,
        siteId: site.id,
        expanded: isExpanded,
        vlans: isExpanded ? vlansToEmbedded(site.vlans) : [],
        wanAddresses: site.wan_addresses ?? [],
      } satisfies SiteNodeData,
    })
  })

  // Create tunnel edges
  topology.tunnels.forEach((tunnel) => {
    edges.push({
      id: `tunnel-${tunnel.id}`,
      source: `site-${tunnel.site_a}`,
      target: `site-${tunnel.site_b}`,
      type: 'tunnelEdge',
      label: tunnel.tunnel_subnet,
      data: {
        label: tunnel.tunnel_subnet,
        tunnelType: tunnel.tunnel_type,
        status: tunnel.status,
        ipA: tunnel.ip_a,
        ipB: tunnel.ip_b,
        offsetSide: 1,
      } satisfies TunnelEdgeData,
    })
  })

  // Auto-layout if no saved positions
  const needsLayout = !savedPositions || Object.keys(savedPositions).length === 0

  if (needsLayout) {
    const strategy = analyzeTopology(nodes, edges)
    if (strategy === 'polygon') {
      return applyPolygonLayout(nodes, edges)
    }
    return applyDagreLayout(nodes, edges)
  }

  // Saved positions exist — check for overlaps and re-layout if needed
  if (hasOverlaps(nodes)) {
    const strategy = analyzeTopology(nodes, edges)
    if (strategy === 'polygon') {
      return applyPolygonLayout(nodes, edges)
    }
    return applyDagreLayout(nodes, edges)
  }

  // Saved positions are fine — still assign handles based on positions
  return { nodes, edges: assignHandles(nodes, edges) }
}

export function savePositions(projectId: number, nodes: Node[]) {
  const positions: Record<string, { x: number; y: number }> = {}
  nodes.forEach((n) => {
    positions[n.id] = n.position
  })
  localStorage.setItem(`topology-positions-${projectId}`, JSON.stringify(positions))
}

export function loadPositions(projectId: number): Record<string, { x: number; y: number }> | undefined {
  const raw = localStorage.getItem(`topology-positions-${projectId}`)
  if (raw) {
    try {
      return JSON.parse(raw)
    } catch {
      return undefined
    }
  }
  return undefined
}

export function clearPositions(projectId: number) {
  localStorage.removeItem(`topology-positions-${projectId}`)
}
