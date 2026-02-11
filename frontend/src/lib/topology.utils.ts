import dagre from 'dagre'
import type { Node, Edge } from '@xyflow/react'
import type { ProjectTopology } from '@/types'

export interface SiteNodeData {
  label: string
  address: string
  vlanCount: number
  hostCount: number
  siteId: number
  expanded: boolean
  [key: string]: unknown
}

export interface VlanNodeData {
  label: string
  vlanId: number
  name: string
  purpose: string
  subnetCount: number
  hostCount: number
  parentSiteId: number
  [key: string]: unknown
}

export interface TunnelEdgeData {
  label: string
  tunnelType: string
  status: string
  [key: string]: unknown
}

const SITE_WIDTH = 200
const SITE_HEIGHT = 80
const VLAN_WIDTH = 160
const VLAN_HEIGHT = 50

export function topologyToFlow(
  topology: ProjectTopology,
  expandedSites: Set<number>,
  savedPositions?: Record<string, { x: number; y: number }>,
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = []
  const edges: Edge[] = []

  // Create site nodes
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
      } satisfies SiteNodeData,
    })

    // If expanded, add VLAN nodes
    if (isExpanded) {
      site.vlans.forEach((vlan) => {
        const vlanHostCount = vlan.subnets.reduce((s, sub) => s + sub.hosts.length, 0)
        nodes.push({
          id: `vlan-${vlan.id}`,
          type: 'vlanNode',
          position: savedPositions?.[`vlan-${vlan.id}`] ?? { x: 0, y: 0 },
          data: {
            label: `VLAN ${vlan.vlan_id}`,
            vlanId: vlan.id,
            name: vlan.name,
            purpose: vlan.purpose,
            subnetCount: vlan.subnets.length,
            hostCount: vlanHostCount,
            parentSiteId: site.id,
          } satisfies VlanNodeData,
        })

        edges.push({
          id: `site-${site.id}-vlan-${vlan.id}`,
          source: `site-${site.id}`,
          target: `vlan-${vlan.id}`,
          type: 'default',
          style: { stroke: '#94a3b8', strokeDasharray: '4 4' },
        })
      })
    }
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
  g.setGraph({ rankdir: 'TB', nodesep: 80, ranksep: 100 })

  nodes.forEach((node) => {
    const w = node.type === 'vlanNode' ? VLAN_WIDTH : SITE_WIDTH
    const h = node.type === 'vlanNode' ? VLAN_HEIGHT : SITE_HEIGHT
    g.setNode(node.id, { width: w, height: h })
  })

  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target)
  })

  dagre.layout(g)

  const layoutedNodes = nodes.map((node) => {
    const n = g.node(node.id)
    const w = node.type === 'vlanNode' ? VLAN_WIDTH : SITE_WIDTH
    const h = node.type === 'vlanNode' ? VLAN_HEIGHT : SITE_HEIGHT
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
