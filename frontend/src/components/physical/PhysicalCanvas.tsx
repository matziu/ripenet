import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  Panel,
  useNodesState,
  useEdgesState,
  useReactFlow,
  useUpdateNodeInternals,
  type NodeTypes,
  type EdgeTypes,
  type Node,
  type Edge,
  type OnNodesChange,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useQuery } from '@tanstack/react-query'
import { physicalTopologyApi } from '@/api/endpoints'
import { useSelectionStore } from '@/stores/selection.store'
import { HostNode, HOST_NODE_WIDTH, HOST_NODE_HEADER_HEIGHT, HOST_NODE_PORT_HEIGHT } from './HostNode'
import type { HostNodeData } from './HostNode'
import { PatchPanelNode, PP_NODE_WIDTH, PP_NODE_HEADER_HEIGHT, PP_NODE_PORT_HEIGHT } from './PatchPanelNode'
import type { PatchPanelNodeData } from './PatchPanelNode'
import { CableEdge } from './CableEdge'
import { PhysicalToolbar } from './PhysicalToolbar'
import { PhysicalTableView } from './PhysicalTableView'
import type { PhysicalTopology, DeviceTypeOption } from '@/types'
import { Cable, Server, Grid3X3 } from 'lucide-react'
import { useDeviceTypes } from '@/hooks/useDeviceTypes'

const nodeTypes: NodeTypes = {
  hostNode: HostNode,
  patchPanelNode: PatchPanelNode,
}

const edgeTypes: EdgeTypes = {
  cableEdge: CableEdge,
}

// --- Position persistence ---

function savePhysicalPositions(siteId: number, nodes: Node[]) {
  const positions: Record<string, { x: number; y: number }> = {}
  nodes.forEach((n) => {
    positions[n.id] = n.position
  })
  localStorage.setItem(`physical-layout-${siteId}`, JSON.stringify(positions))
}

function loadPhysicalPositions(siteId: number): Record<string, { x: number; y: number }> | undefined {
  const raw = localStorage.getItem(`physical-layout-${siteId}`)
  if (raw) {
    try {
      return JSON.parse(raw)
    } catch {
      return undefined
    }
  }
  return undefined
}

function clearPhysicalPositions(siteId: number) {
  localStorage.removeItem(`physical-layout-${siteId}`)
}

// --- Schematic layout: columns by device role + barycenter crossing minimization ---

const CORE_DEVICE_TYPES = new Set([
  'router', 'switch', 'firewall', 'load_balancer',
  'core_switch', 'distribution_switch',
])

function getNodeHeight(node: Node): number {
  const ports = ((node.data as { ports?: unknown[] }).ports?.length ?? 0)
  return node.type === 'hostNode'
    ? HOST_NODE_HEADER_HEIGHT + ports * HOST_NODE_PORT_HEIGHT + 12
    : PP_NODE_HEADER_HEIGHT + ports * PP_NODE_PORT_HEIGHT + 12
}

function applySchematicLayout(
  nodes: Node[],
  edges: Edge[],
): { nodes: Node[]; edges: Edge[] } {
  if (nodes.length === 0) return { nodes, edges }

  // Build adjacency list
  const adj = new Map<string, string[]>()
  nodes.forEach((n) => adj.set(n.id, []))
  edges.forEach((e) => {
    adj.get(e.source)?.push(e.target)
    adj.get(e.target)?.push(e.source)
  })

  // Classify nodes into 3 columns: core | patch panels | endpoints
  const columns: Node[][] = [[], [], []]
  const nodeCol = new Map<string, number>()

  for (const node of nodes) {
    let col: number
    if (node.type === 'patchPanelNode') {
      col = 1
    } else {
      const dt = ((node.data as HostNodeData).device_type || '').toLowerCase()
      col = CORE_DEVICE_TYPES.has(dt) ? 0 : 2
    }
    columns[col].push(node)
    nodeCol.set(node.id, col)
  }

  // Compact: remove empty columns, track mapping
  const activeCols: Node[][] = []
  const origToActive = new Map<number, number>()
  for (let i = 0; i < columns.length; i++) {
    if (columns[i].length > 0) {
      origToActive.set(i, activeCols.length)
      activeCols.push(columns[i])
    }
  }

  const nodeActiveCol = new Map<string, number>()
  for (const node of nodes) {
    const orig = nodeCol.get(node.id) ?? 2
    nodeActiveCol.set(node.id, origToActive.get(orig) ?? 0)
  }

  // Deterministic initial sort
  for (const col of activeCols) {
    col.sort((a, b) => a.id.localeCompare(b.id))
  }

  // Assign Y positions (stacked top-down per column)
  const GAP = 30
  const nodeY = new Map<string, number>()

  const assignY = () => {
    for (const col of activeCols) {
      let y = 0
      for (const node of col) {
        nodeY.set(node.id, y)
        y += getNodeHeight(node) + GAP
      }
    }
  }
  assignY()

  // Barycenter iterations to minimize edge crossings
  for (let iter = 0; iter < 8; iter++) {
    // Forward pass (left → right)
    for (let ci = 1; ci < activeCols.length; ci++) {
      const col = activeCols[ci]
      const bary = new Map<string, number>()
      for (const node of col) {
        const nbrs = (adj.get(node.id) || []).filter((nid) => {
          const nc = nodeActiveCol.get(nid)
          return nc !== undefined && nc < ci
        })
        bary.set(
          node.id,
          nbrs.length > 0
            ? nbrs.reduce((s, nid) => s + (nodeY.get(nid) ?? 0), 0) / nbrs.length
            : (nodeY.get(node.id) ?? 0),
        )
      }
      col.sort((a, b) => (bary.get(a.id) ?? 0) - (bary.get(b.id) ?? 0))
    }
    // Backward pass (right → left)
    for (let ci = activeCols.length - 2; ci >= 0; ci--) {
      const col = activeCols[ci]
      const bary = new Map<string, number>()
      for (const node of col) {
        const nbrs = (adj.get(node.id) || []).filter((nid) => {
          const nc = nodeActiveCol.get(nid)
          return nc !== undefined && nc > ci
        })
        bary.set(
          node.id,
          nbrs.length > 0
            ? nbrs.reduce((s, nid) => s + (nodeY.get(nid) ?? 0), 0) / nbrs.length
            : (nodeY.get(node.id) ?? 0),
        )
      }
      col.sort((a, b) => (bary.get(a.id) ?? 0) - (bary.get(b.id) ?? 0))
    }
    assignY()
  }

  // Center columns vertically relative to the tallest one
  const colHeights = activeCols.map((col) => {
    let h = 0
    for (const node of col) h += getNodeHeight(node) + GAP
    return Math.max(0, h - GAP)
  })
  const maxH = Math.max(...colHeights, 0)
  const colYOffset = colHeights.map((h) => (maxH - h) / 2)

  // Assign X positions per column
  const COL_SPACING = 300
  const colX: number[] = []
  let x = 0
  for (const col of activeCols) {
    colX.push(x)
    const maxW = Math.max(...col.map((n) => (n.type === 'hostNode' ? HOST_NODE_WIDTH : PP_NODE_WIDTH)))
    x += maxW + COL_SPACING
  }

  // Apply positions
  const positioned = nodes.map((node) => {
    const ci = nodeActiveCol.get(node.id) ?? 0
    return {
      ...node,
      position: {
        x: colX[ci] ?? 0,
        y: (nodeY.get(node.id) ?? 0) + (colYOffset[ci] ?? 0),
      },
    }
  })

  return { nodes: positioned, edges }
}

// --- Convert API data to React Flow ---

function physicalToFlow(
  data: PhysicalTopology,
  savedPositions?: Record<string, { x: number; y: number }>,
  deviceTypeMap?: Map<string, DeviceTypeOption>,
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = []
  const edges: Edge[] = []

  // Build set of connected port IDs for styling
  const connectedPortIds = new Set<number>()
  data.cables.forEach((cable) => {
    connectedPortIds.add(cable.port_a)
    connectedPortIds.add(cable.port_b)
  })

  // Build port-to-node lookup for edge creation
  const portToNode = new Map<number, string>()
  const portToHandleId = new Map<number, string>()

  // Track which node is a patch panel for handle side selection
  const ppNodeIds = new Set<string>()

  data.hosts.forEach((host) => {
    const nodeId = `host-${host.id}`
    const dt = deviceTypeMap?.get(host.device_type)
    const nodeData: HostNodeData = {
      ...host,
      connectedPorts: connectedPortIds,
      portSide: 'right',
      color: dt?.color,
      device_type_label: dt?.label,
    }
    nodes.push({
      id: nodeId,
      type: 'hostNode',
      position: savedPositions?.[nodeId] ?? { x: 0, y: 0 },
      data: nodeData,
    })
    host.ports.forEach((port) => {
      portToNode.set(port.id, nodeId)
      portToHandleId.set(port.id, `port-${port.id}`)
    })
  })

  data.patch_panels.forEach((pp) => {
    const nodeId = `pp-${pp.id}`
    ppNodeIds.add(nodeId)
    const nodeData: PatchPanelNodeData = {
      ...pp,
      connectedPorts: connectedPortIds,
    }
    nodes.push({
      id: nodeId,
      type: 'patchPanelNode',
      position: savedPositions?.[nodeId] ?? { x: 0, y: 0 },
      data: nodeData,
    })
    pp.ports.forEach((port) => {
      portToNode.set(port.id, nodeId)
      // Patch panels have handles on both sides: -left and -right
      portToHandleId.set(port.id, `port-${port.id}`)
    })
  })

  data.cables.forEach((cable) => {
    const sourceNode = portToNode.get(cable.port_a)
    const targetNode = portToNode.get(cable.port_b)
    if (sourceNode && targetNode) {
      // For patch panel handles, choose the correct side:
      // - If connecting to a node on the left, use -left handle
      // - If connecting to a node on the right, use -right handle
      // For simplicity, use -right for source side and -left for target side of patch panels
      const sourceHandle = ppNodeIds.has(sourceNode)
        ? `${portToHandleId.get(cable.port_a)}-right`
        : portToHandleId.get(cable.port_a)
      const targetHandle = ppNodeIds.has(targetNode)
        ? `${portToHandleId.get(cable.port_b)}-left`
        : portToHandleId.get(cable.port_b)

      edges.push({
        id: `cable-${cable.id}`,
        source: sourceNode,
        target: targetNode,
        sourceHandle,
        targetHandle,
        type: 'cableEdge',
        data: { ...cable },
      })
    }
  })

  // Apply layout if no saved positions
  let result: { nodes: Node[]; edges: Edge[] }
  if (!savedPositions || Object.keys(savedPositions).length === 0) {
    result = applySchematicLayout(nodes, edges)
  } else {
    result = { nodes, edges }
  }

  // Compute portSide for each host based on neighbor positions
  const posMap = new Map<string, number>()
  for (const n of result.nodes) posMap.set(n.id, n.position.x)

  const adj = new Map<string, string[]>()
  for (const n of result.nodes) adj.set(n.id, [])
  for (const e of result.edges) {
    adj.get(e.source)?.push(e.target)
    adj.get(e.target)?.push(e.source)
  }

  for (const node of result.nodes) {
    if (node.type !== 'hostNode') continue
    const myX = posMap.get(node.id) ?? 0
    const neighbors = adj.get(node.id) ?? []
    if (neighbors.length === 0) continue
    const avgX = neighbors.reduce((s, nid) => s + (posMap.get(nid) ?? 0), 0) / neighbors.length
    ;(node.data as HostNodeData).portSide = avgX >= myX ? 'right' : 'left'
  }

  return result
}

// --- Recompute port sides based on current node positions ---

function recomputePortSides(nodes: Node[], edges: Edge[]): Node[] {
  const posMap = new Map<string, number>()
  for (const n of nodes) posMap.set(n.id, n.position.x)

  const adj = new Map<string, string[]>()
  for (const n of nodes) adj.set(n.id, [])
  for (const e of edges) {
    adj.get(e.source)?.push(e.target)
    adj.get(e.target)?.push(e.source)
  }

  let changed = false
  const result = nodes.map((node) => {
    if (node.type !== 'hostNode') return node
    const myX = posMap.get(node.id) ?? 0
    const neighbors = adj.get(node.id) ?? []
    if (neighbors.length === 0) return node
    const avgX = neighbors.reduce((s, nid) => s + (posMap.get(nid) ?? 0), 0) / neighbors.length
    const newSide = avgX >= myX ? 'right' : 'left'
    if ((node.data as HostNodeData).portSide === newSide) return node
    changed = true
    return { ...node, data: { ...node.data, portSide: newSide } }
  })
  return changed ? result : nodes
}

// --- Stats panel ---

function PhysicalStats({ data }: { data: PhysicalTopology }) {
  return (
    <Panel position="top-left">
      <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-card/90 backdrop-blur-sm px-3 py-1.5 shadow-sm text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <Server className="h-3 w-3" />
          {data.hosts.length} hosts
        </span>
        <span className="flex items-center gap-1">
          <Grid3X3 className="h-3 w-3" />
          {data.patch_panels.length} panels
        </span>
        <span className="flex items-center gap-1">
          <Cable className="h-3 w-3" />
          {data.cables.length} cables
        </span>
      </div>
    </Panel>
  )
}

// --- Inner canvas ---

interface PhysicalCanvasInnerProps {
  siteId: number
  viewMode: 'graph' | 'table'
  onViewModeChange: (mode: 'graph' | 'table') => void
}

function PhysicalCanvasInner({ siteId, viewMode, onViewModeChange }: PhysicalCanvasInnerProps) {
  const { fitView } = useReactFlow()
  const [layoutKey, setLayoutKey] = useState(0)
  const deviceTypeMap = useDeviceTypes()

  const { data: physicalData, isLoading } = useQuery({
    queryKey: ['physical-topology', siteId],
    queryFn: () => physicalTopologyApi.get(siteId),
    select: (res) => res.data,
    enabled: !!siteId,
  })

  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    if (!physicalData) return { nodes: [], edges: [] }
    const positions = loadPhysicalPositions(siteId)
    return physicalToFlow(physicalData, positions, deviceTypeMap)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [physicalData, siteId, layoutKey, deviceTypeMap])

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  const nodesRef = useRef(nodes)
  nodesRef.current = nodes
  const edgesRef = useRef(edges)
  edgesRef.current = edges

  // Force React Flow to recalculate handle positions after data/layout changes
  const updateNodeInternals = useUpdateNodeInternals()

  useEffect(() => {
    setNodes(initialNodes)
    setEdges(initialEdges)
    // Handles may have moved (portSide changed) — tell React Flow to re-measure
    const hostIds = initialNodes.filter((n) => n.type === 'hostNode').map((n) => n.id)
    if (hostIds.length > 0) {
      // Wait for DOM to paint with new handle positions, then re-measure
      requestAnimationFrame(() => {
        requestAnimationFrame(() => updateNodeInternals(hostIds))
      })
    }
  }, [initialNodes, initialEdges, setNodes, setEdges, updateNodeInternals])

  const handleNodesChange: OnNodesChange = useCallback(
    (changes) => {
      onNodesChange(changes)
      const hasDragStop = changes.some(
        (c) => c.type === 'position' && !c.dragging && c.position,
      )
      if (hasDragStop) {
        requestAnimationFrame(() => {
          savePhysicalPositions(siteId, nodesRef.current)
        })
      }
    },
    [onNodesChange, siteId],
  )

  // Recompute port sides live during drag + force handle recalculation
  const onNodeDrag = useCallback(() => {
    setNodes((prev) => {
      const next = recomputePortSides(prev, edgesRef.current)
      if (next !== prev) {
        // Collect IDs of nodes whose portSide changed
        const changed: string[] = []
        for (let i = 0; i < next.length; i++) {
          if (next[i] !== prev[i]) changed.push(next[i].id)
        }
        if (changed.length > 0) {
          requestAnimationFrame(() => updateNodeInternals(changed))
        }
      }
      return next
    })
  }, [setNodes, updateNodeInternals])

  const onNodeDragStop = useCallback(() => {
    savePhysicalPositions(siteId, nodesRef.current)
  }, [siteId])

  const handleRelayout = useCallback(() => {
    clearPhysicalPositions(siteId)
    setLayoutKey((k) => k + 1)
    setTimeout(() => fitView({ duration: 300 }), 50)
  }, [siteId, fitView])

  // Collect visible cable types for the legend
  const visibleCableTypes = useMemo(() => {
    if (!physicalData) return []
    const seen = new Set<string>()
    for (const c of physicalData.cables) {
      seen.add(c.cable_type)
    }
    return Array.from(seen).sort()
  }, [physicalData])

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Loading physical topology...
      </div>
    )
  }

  if (!physicalData) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        No physical topology data available.
      </div>
    )
  }

  if (physicalData.hosts.length === 0 && physicalData.patch_panels.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center max-w-md space-y-3">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <Cable className="h-7 w-7 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">
            No devices or patch panels in this site yet. Add hosts with ports and patch panels to see the physical topology.
          </p>
        </div>
      </div>
    )
  }

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={handleNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeDrag={onNodeDrag}
      onNodeDragStop={onNodeDragStop}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      fitView
      minZoom={0.1}
      maxZoom={2}
      className="bg-background"
    >
      <Background variant={BackgroundVariant.Dots} gap={16} size={1} className="!text-border/40" />
      <Controls className="!bg-card !border-border/50 !shadow-md !rounded-lg [&>button]:!bg-card [&>button]:!border-border/50 [&>button]:!text-foreground [&>button:hover]:!bg-accent [&>button>svg]:!fill-foreground" />
      <PhysicalStats data={physicalData} />
      <PhysicalToolbar onRelayout={handleRelayout} visibleCableTypes={visibleCableTypes} viewMode={viewMode} onViewModeChange={onViewModeChange} />
    </ReactFlow>
  )
}

// --- Public component ---

interface PhysicalCanvasProps {
  projectId: number
  urlSiteId: number | null
  urlViewMode: 'graph' | 'table'
  onNavigate: (siteId: number | null, mode: 'graph' | 'table') => void
}

export function PhysicalCanvas({ projectId: _projectId, urlSiteId, urlViewMode, onNavigate }: PhysicalCanvasProps) {
  const storeSiteId = useSelectionStore((s) => s.selectedSiteId)
  const selectedSiteId = urlSiteId ?? storeSiteId
  const viewMode = urlViewMode

  const handleViewModeChange = useCallback(
    (mode: 'graph' | 'table') => {
      if (selectedSiteId) {
        onNavigate(selectedSiteId, mode)
      }
    },
    [selectedSiteId, onNavigate],
  )

  if (!selectedSiteId) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center max-w-md space-y-3">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <Cable className="h-7 w-7 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-medium">Physical Topology (L1)</p>
            <p className="text-sm text-muted-foreground mt-1">
              Select a site from the sidebar to view its physical layer topology with devices, patch panels, and cabling.
            </p>
          </div>
        </div>
      </div>
    )
  }

  if (viewMode === 'table') {
    return (
      <PhysicalTableView siteId={selectedSiteId} viewMode={viewMode} onViewModeChange={handleViewModeChange} />
    )
  }

  return (
    <ReactFlowProvider>
      <PhysicalCanvasInner siteId={selectedSiteId} viewMode={viewMode} onViewModeChange={handleViewModeChange} />
    </ReactFlowProvider>
  )
}
