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

// Fallback colors by index for unmapped purposes
const VLAN_INDEX_COLORS = [
  { bg: 'bg-emerald-500/10', border: 'border-emerald-500/40', text: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500' },
  { bg: 'bg-blue-500/10', border: 'border-blue-500/40', text: 'text-blue-700 dark:text-blue-400', dot: 'bg-blue-500' },
  { bg: 'bg-violet-500/10', border: 'border-violet-500/40', text: 'text-violet-700 dark:text-violet-400', dot: 'bg-violet-500' },
  { bg: 'bg-amber-500/10', border: 'border-amber-500/40', text: 'text-amber-700 dark:text-amber-400', dot: 'bg-amber-500' },
  { bg: 'bg-rose-500/10', border: 'border-rose-500/40', text: 'text-rose-700 dark:text-rose-400', dot: 'bg-rose-500' },
  { bg: 'bg-cyan-500/10', border: 'border-cyan-500/40', text: 'text-cyan-700 dark:text-cyan-400', dot: 'bg-cyan-500' },
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
  [key: string]: unknown
}

export interface TunnelEdgeData {
  label: string
  tunnelType: string
  status: string
  [key: string]: unknown
}

const SITE_WIDTH_COLLAPSED = 200
const SITE_HEIGHT_COLLAPSED = 80
const SITE_WIDTH_EXPANDED = 280
const VLAN_ROW_HEIGHT = 36
const SITE_EXPANDED_PADDING = 80

function getSiteSize(expanded: boolean, vlanCount: number) {
  if (!expanded) return { w: SITE_WIDTH_COLLAPSED, h: SITE_HEIGHT_COLLAPSED }
  return {
    w: SITE_WIDTH_EXPANDED,
    h: SITE_EXPANDED_PADDING + vlanCount * VLAN_ROW_HEIGHT,
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
      } satisfies TunnelEdgeData,
    })
  })

  // Auto-layout if no saved positions
  if (!savedPositions || Object.keys(savedPositions).length === 0) {
    return applyDagreLayout(nodes, edges)
  }

  return { nodes, edges }
}

function applyDagreLayout(
  nodes: Node[],
  edges: Edge[],
): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'TB', nodesep: 100, ranksep: 120 })

  nodes.forEach((node) => {
    const d = node.data as SiteNodeData
    const { w, h } = getSiteSize(d.expanded, d.vlans.length)
    g.setNode(node.id, { width: w, height: h })
  })

  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target)
  })

  dagre.layout(g)

  const layoutedNodes = nodes.map((node) => {
    const n = g.node(node.id)
    const d = node.data as SiteNodeData
    const { w, h } = getSiteSize(d.expanded, d.vlans.length)
    return {
      ...node,
      position: { x: n.x - w / 2, y: n.y - h / 2 },
    }
  })

  return { nodes: layoutedNodes, edges }
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
