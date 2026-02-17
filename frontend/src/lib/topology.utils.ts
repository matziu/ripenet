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

function ipToInt(ip: string): number {
  const bare = ip.split('/')[0]
  return bare.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0
}

export function getVlanColor(purpose: string, index: number) {
  const key = purpose.toLowerCase()
  return VLAN_PURPOSE_COLORS[key] ?? VLAN_INDEX_COLORS[index % VLAN_INDEX_COLORS.length]
}

export interface SubnetBrief {
  network: string
  hostCount: number
  dhcpPoolSize: number
}

export interface VlanEmbedded {
  id: number
  vlanId: number
  name: string
  purpose: string
  subnets: string[]
  subnetDetails: SubnetBrief[]
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
  standaloneSubnets: SubnetBrief[]
  wanAddresses: { ip_address: string; label: string }[]
  isExternal?: boolean
  isCrossProject?: boolean
  crossProjectId?: number
  [key: string]: unknown
}

export interface TunnelEdgeData {
  label: string
  tunnelType: string
  enabled: boolean
  ipA: string
  ipB: string
  offsetSide: number
  externalEndpoint?: string
  crossProjectName?: string
  crossProjectId?: number
  [key: string]: unknown
}

const SITE_WIDTH = 260
const SITE_HEIGHT_COLLAPSED = 80
const VLAN_ROW_HEIGHT = 36
const SITE_EXPANDED_PADDING = 80
const STANDALONE_SUBNET_ROW_HEIGHT = 28
const STANDALONE_SECTION_HEADER = 20

const WAN_ROW_HEIGHT = 18

function getSiteSize(expanded: boolean, vlanCount: number, wanCount = 0, standaloneCount = 0) {
  const wanExtra = wanCount * WAN_ROW_HEIGHT
  if (!expanded) return { w: SITE_WIDTH, h: SITE_HEIGHT_COLLAPSED + wanExtra }
  const standaloneExtra = standaloneCount > 0
    ? STANDALONE_SECTION_HEADER + standaloneCount * STANDALONE_SUBNET_ROW_HEIGHT
    : 0
  return {
    w: SITE_WIDTH,
    h: SITE_EXPANDED_PADDING + vlanCount * VLAN_ROW_HEIGHT + standaloneExtra + wanExtra,
  }
}

function vlansToEmbedded(vlans: VLANTopology[]): VlanEmbedded[] {
  return vlans.map((vlan, i) => ({
    id: vlan.id,
    vlanId: vlan.vlan_id,
    name: vlan.name,
    purpose: vlan.purpose,
    subnets: vlan.subnets.map((s) => s.network),
    subnetDetails: vlan.subnets.map((s) => ({
      network: s.network,
      hostCount: s.hosts.length,
      dhcpPoolSize: (s.dhcp_pools ?? []).reduce((sum, p) => {
        const start = ipToInt(p.start_ip)
        const end = ipToInt(p.end_ip)
        return sum + (end - start + 1)
      }, 0),
    })),
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
      return getSiteSize(d.expanded, d.vlans.length, d.wanAddresses?.length ?? 0, d.standaloneSubnets?.length ?? 0)
    })
    const layoutedNodes = nodes.map((node, i) => ({
      ...node,
      position: { x: i * (sizes[i].w + 250), y: 0 },
    }))
    return { nodes: layoutedNodes, edges: assignLabelOffsets(layoutedNodes, edges) }
  }

  // Find max node size for radius calculation
  let maxDim = 0
  for (const node of nodes) {
    const d = node.data as SiteNodeData
    const { w, h } = getSiteSize(d.expanded, d.vlans.length, d.wanAddresses?.length ?? 0, d.standaloneSubnets?.length ?? 0)
    maxDim = Math.max(maxDim, w, h)
  }

  const radius = Math.max(250, maxDim * 1.8)
  const startAngle = -Math.PI / 2 // Start from top

  const layoutedNodes = nodes.map((node, i) => {
    const d = node.data as SiteNodeData
    const { w, h } = getSiteSize(d.expanded, d.vlans.length, d.wanAddresses?.length ?? 0, d.standaloneSubnets?.length ?? 0)
    const angle = startAngle + (2 * Math.PI * i) / n
    return {
      ...node,
      position: {
        x: Math.cos(angle) * radius - w / 2,
        y: Math.sin(angle) * radius - h / 2,
      },
    }
  })

  return { nodes: layoutedNodes, edges: assignLabelOffsets(layoutedNodes, edges) }
}

/** Check if any node bounding boxes overlap (with padding). */
export function hasOverlaps(nodes: Node[], padding = 30): boolean {
  const boxes = nodes.map((node) => {
    const d = node.data as SiteNodeData
    const { w, h } = getSiteSize(d.expanded, d.vlans.length, d.wanAddresses?.length ?? 0, d.standaloneSubnets?.length ?? 0)
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

// --- Label offset assignment ---

/**
 * Compute offsetSide (+1 or -1) per edge so IP labels are pushed
 * away from the graph centroid — ensures symmetric, non-overlapping labels.
 * Handle assignment is no longer needed — floating edges calculate connection
 * points dynamically based on real-time node positions.
 */
function assignLabelOffsets(nodes: Node[], edges: Edge[]): Edge[] {
  const centerMap = new Map<string, { cx: number; cy: number }>()
  for (const node of nodes) {
    const d = node.data as SiteNodeData
    const { w, h } = getSiteSize(d.expanded, d.vlans.length, d.wanAddresses?.length ?? 0, d.standaloneSubnets?.length ?? 0)
    centerMap.set(node.id, {
      cx: node.position.x + w / 2,
      cy: node.position.y + h / 2,
    })
  }

  let centroidX = 0
  let centroidY = 0
  for (const c of centerMap.values()) {
    centroidX += c.cx
    centroidY += c.cy
  }
  centroidX /= centerMap.size
  centroidY /= centerMap.size

  return edges.map((edge) => {
    const src = centerMap.get(edge.source)
    const tgt = centerMap.get(edge.target)

    let offsetSide = 1
    if (src && tgt) {
      const edgeMidX = (src.cx + tgt.cx) / 2
      const edgeMidY = (src.cy + tgt.cy) / 2
      const dx = tgt.cx - src.cx
      const dy = tgt.cy - src.cy
      const len = Math.sqrt(dx * dx + dy * dy) || 1

      const nx = -dy / len
      const ny = dx / len

      const toMidX = edgeMidX - centroidX
      const toMidY = edgeMidY - centroidY
      const dot = nx * toMidX + ny * toMidY
      offsetSide = dot >= 0 ? 1 : -1
    }

    return {
      ...edge,
      data: { ...edge.data, offsetSide },
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
    const { w, h } = getSiteSize(d.expanded, d.vlans.length, d.wanAddresses?.length ?? 0, d.standaloneSubnets?.length ?? 0)
    g.setNode(node.id, { width: w + 40, height: h + 40 })
  })

  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target, { minlen: 2 })
  })

  dagre.layout(g)

  const layoutedNodes = nodes.map((node) => {
    const n = g.node(node.id)
    const d = node.data as SiteNodeData
    const { w, h } = getSiteSize(d.expanded, d.vlans.length, d.wanAddresses?.length ?? 0, d.standaloneSubnets?.length ?? 0)
    return {
      ...node,
      position: { x: n.x - w / 2, y: n.y - h / 2 },
    }
  })

  return { nodes: layoutedNodes, edges: assignLabelOffsets(layoutedNodes, edges) }
}

export function topologyToFlow(
  topology: ProjectTopology,
  expandedSites: Set<number>,
  savedPositions?: Record<string, { x: number; y: number }>,
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = []
  const edges: Edge[] = []

  topology.sites.forEach((site) => {
    const vlanHosts = site.vlans.reduce(
      (sum, v) => sum + v.subnets.reduce((s, sub) => s + sub.hosts.length, 0),
      0,
    )
    const standaloneHosts = (site.standalone_subnets ?? []).reduce(
      (sum, sub) => sum + sub.hosts.length, 0,
    )
    const totalHosts = vlanHosts + standaloneHosts
    const isExpanded = expandedSites.has(site.id)

    const standaloneSubnetsBrief: SubnetBrief[] = (site.standalone_subnets ?? []).map((s) => ({
      network: s.network,
      hostCount: s.hosts.length,
      dhcpPoolSize: (s.dhcp_pools ?? []).reduce((sum, p) => {
        const start = ipToInt(p.start_ip)
        const end = ipToInt(p.end_ip)
        return sum + (end - start + 1)
      }, 0),
    }))

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
        standaloneSubnets: isExpanded ? standaloneSubnetsBrief : [],
        wanAddresses: site.wan_addresses ?? [],
      } satisfies SiteNodeData,
    })
  })

  // Create tunnel edges (with virtual nodes for cross-project/external)
  const nodeIdSet = new Set(nodes.map(n => n.id))

  topology.tunnels.forEach((tunnel) => {
    // Resolve source node (site_a) — may need virtual node for cross-project view
    let sourceNodeId = `site-${tunnel.site_a}`
    if (!nodeIdSet.has(sourceNodeId)) {
      const xId = `xsite-${tunnel.site_a}`
      if (!nodeIdSet.has(xId)) {
        nodes.push({
          id: xId,
          type: 'siteNode',
          position: savedPositions?.[xId] ?? { x: 0, y: 0 },
          data: {
            label: tunnel.site_a_name,
            address: '',
            vlanCount: 0,
            hostCount: 0,
            siteId: tunnel.site_a,
            expanded: false,
            vlans: [],
            standaloneSubnets: [],
            wanAddresses: [],
            isCrossProject: true,
            crossProjectId: tunnel.project,
          } satisfies SiteNodeData,
        })
        nodeIdSet.add(xId)
      }
      sourceNodeId = xId
    }

    // Resolve target node (site_b or external)
    let targetNodeId: string

    if (tunnel.site_b && nodeIdSet.has(`site-${tunnel.site_b}`)) {
      // Internal tunnel — target node already exists
      targetNodeId = `site-${tunnel.site_b}`
    } else if (tunnel.site_b) {
      // Cross-project tunnel — site_b exists but not in this project's topology nodes
      targetNodeId = `xsite-${tunnel.site_b}`
      if (!nodeIdSet.has(targetNodeId)) {
        const label = tunnel.site_b_project_name
          ? `${tunnel.site_b_project_name} / ${tunnel.site_b_name}`
          : tunnel.site_b_name ?? 'Remote Site'
        nodes.push({
          id: targetNodeId,
          type: 'siteNode',
          position: savedPositions?.[targetNodeId] ?? { x: 0, y: 0 },
          data: {
            label,
            address: '',
            vlanCount: 0,
            hostCount: 0,
            siteId: tunnel.site_b,
            expanded: false,
            vlans: [],
            standaloneSubnets: [],
            wanAddresses: [],
            isCrossProject: true,
            crossProjectId: tunnel.site_b_project_id ?? undefined,
          } satisfies SiteNodeData,
        })
        nodeIdSet.add(targetNodeId)
      }
    } else {
      // External tunnel — no site_b
      targetNodeId = `ext-${tunnel.id}`
      nodes.push({
        id: targetNodeId,
        type: 'siteNode',
        position: savedPositions?.[targetNodeId] ?? { x: 0, y: 0 },
        data: {
          label: tunnel.external_endpoint || 'External',
          address: '',
          vlanCount: 0,
          hostCount: 0,
          siteId: 0,
          expanded: false,
          vlans: [],
          standaloneSubnets: [],
          wanAddresses: [],
          isExternal: true,
        } satisfies SiteNodeData,
      })
      nodeIdSet.add(targetNodeId)
    }

    const edgeData: TunnelEdgeData = {
      label: tunnel.tunnel_subnet,
      tunnelType: tunnel.tunnel_type,
      enabled: tunnel.enabled,
      ipA: tunnel.ip_a,
      ipB: tunnel.ip_b,
      offsetSide: 1,
    }

    if (tunnel.external_endpoint) {
      edgeData.externalEndpoint = tunnel.external_endpoint
    }
    if (tunnel.site_b_project_id && tunnel.site_b_project_name && tunnel.site_b_project_id !== tunnel.project) {
      edgeData.crossProjectName = `${tunnel.site_b_project_name} / ${tunnel.site_b_name}`
      edgeData.crossProjectId = tunnel.site_b_project_id
    }

    edges.push({
      id: `tunnel-${tunnel.id}`,
      source: sourceNodeId,
      target: targetNodeId,
      type: 'tunnelEdge',
      label: tunnel.tunnel_subnet,
      data: edgeData,
    })
  })

  // Auto-layout only if no saved positions at all
  const needsLayout = !savedPositions || Object.keys(savedPositions).length === 0

  if (needsLayout) {
    const strategy = analyzeTopology(nodes, edges)
    if (strategy === 'polygon') {
      return applyPolygonLayout(nodes, edges)
    }
    return applyDagreLayout(nodes, edges)
  }

  // Saved positions exist — place any new nodes (without saved pos) near existing ones
  const nodesWithoutPos = nodes.filter(
    (n) => n.position.x === 0 && n.position.y === 0 && !savedPositions[n.id],
  )
  if (nodesWithoutPos.length > 0) {
    const nodesWithPos = nodes.filter((n) => savedPositions[n.id])
    let maxY = 0
    let avgX = 0
    if (nodesWithPos.length > 0) {
      for (const n of nodesWithPos) {
        const d = n.data as SiteNodeData
        const { h } = getSiteSize(d.expanded, d.vlans.length, d.wanAddresses?.length ?? 0, d.standaloneSubnets?.length ?? 0)
        if (n.position.y + h > maxY) maxY = n.position.y + h
        avgX += n.position.x
      }
      avgX = avgX / nodesWithPos.length
    }
    nodesWithoutPos.forEach((n, i) => {
      n.position = { x: avgX + i * 250, y: maxY + 80 }
    })
  }

  // Always respect saved positions — never auto-relayout
  return { nodes, edges: assignLabelOffsets(nodes, edges) }
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
