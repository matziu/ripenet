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
  type NodeTypes,
  type EdgeTypes,
  type Node,
  type Edge,
  type OnNodesChange,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import dagre from 'dagre'

import { useQuery } from '@tanstack/react-query'
import { physicalTopologyApi } from '@/api/endpoints'
import { useSelectionStore } from '@/stores/selection.store'
import { HostNode, HOST_NODE_WIDTH, HOST_NODE_HEADER_HEIGHT, HOST_NODE_PORT_HEIGHT } from './HostNode'
import type { HostNodeData } from './HostNode'
import { PatchPanelNode, PP_NODE_WIDTH, PP_NODE_HEADER_HEIGHT, PP_NODE_PORT_HEIGHT } from './PatchPanelNode'
import type { PatchPanelNodeData } from './PatchPanelNode'
import { CableEdge } from './CableEdge'
import { PhysicalToolbar } from './PhysicalToolbar'
import type { PhysicalTopology } from '@/types'
import { Cable, Server, Grid3X3 } from 'lucide-react'

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

// --- Dagre layout for physical topology ---

function applyPhysicalDagreLayout(
  nodes: Node[],
  edges: Edge[],
): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({
    rankdir: 'TB',
    nodesep: 100,
    ranksep: 200,
    edgesep: 20,
  })

  nodes.forEach((node) => {
    const portCount = (node.data as { ports?: unknown[] }).ports?.length ?? 0
    let w: number
    let h: number
    if (node.type === 'hostNode') {
      w = HOST_NODE_WIDTH
      h = HOST_NODE_HEADER_HEIGHT + portCount * HOST_NODE_PORT_HEIGHT + 12
    } else {
      w = PP_NODE_WIDTH
      h = PP_NODE_HEADER_HEIGHT + portCount * PP_NODE_PORT_HEIGHT + 12
    }
    g.setNode(node.id, { width: w + 30, height: h + 30 })
  })

  edges.forEach((edge) => {
    g.setEdge(edge.source, edge.target)
  })

  dagre.layout(g)

  const layoutedNodes = nodes.map((node) => {
    const n = g.node(node.id)
    const portCount = (node.data as { ports?: unknown[] }).ports?.length ?? 0
    let w: number
    let h: number
    if (node.type === 'hostNode') {
      w = HOST_NODE_WIDTH
      h = HOST_NODE_HEADER_HEIGHT + portCount * HOST_NODE_PORT_HEIGHT + 12
    } else {
      w = PP_NODE_WIDTH
      h = PP_NODE_HEADER_HEIGHT + portCount * PP_NODE_PORT_HEIGHT + 12
    }
    return {
      ...node,
      position: { x: n.x - w / 2, y: n.y - h / 2 },
    }
  })

  return { nodes: layoutedNodes, edges }
}

// --- Convert API data to React Flow ---

function physicalToFlow(
  data: PhysicalTopology,
  savedPositions?: Record<string, { x: number; y: number }>,
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
    const nodeData: HostNodeData = {
      ...host,
      connectedPorts: connectedPortIds,
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

  // Apply dagre layout if no saved positions
  if (!savedPositions || Object.keys(savedPositions).length === 0) {
    return applyPhysicalDagreLayout(nodes, edges)
  }

  return { nodes, edges }
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
}

function PhysicalCanvasInner({ siteId }: PhysicalCanvasInnerProps) {
  const { fitView } = useReactFlow()
  const [layoutKey, setLayoutKey] = useState(0)

  const { data: physicalData, isLoading } = useQuery({
    queryKey: ['physical-topology', siteId],
    queryFn: () => physicalTopologyApi.get(siteId),
    select: (res) => res.data,
    enabled: !!siteId,
  })

  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    if (!physicalData) return { nodes: [], edges: [] }
    const positions = loadPhysicalPositions(siteId)
    return physicalToFlow(physicalData, positions)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [physicalData, siteId, layoutKey])

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  const nodesRef = useRef(nodes)
  nodesRef.current = nodes

  useEffect(() => {
    setNodes(initialNodes)
    setEdges(initialEdges)
  }, [initialNodes, initialEdges, setNodes, setEdges])

  const handleNodesChange: OnNodesChange = useCallback(
    (changes) => {
      onNodesChange(changes)
      const hasPositionChange = changes.some(
        (c) => c.type === 'position' && !c.dragging && c.position,
      )
      if (hasPositionChange) {
        requestAnimationFrame(() => {
          savePhysicalPositions(siteId, nodesRef.current)
        })
      }
    },
    [onNodesChange, siteId],
  )

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
      <PhysicalToolbar onRelayout={handleRelayout} visibleCableTypes={visibleCableTypes} />
    </ReactFlow>
  )
}

// --- Public component ---

interface PhysicalCanvasProps {
  projectId: number
}

export function PhysicalCanvas({ projectId: _projectId }: PhysicalCanvasProps) {
  const selectedSiteId = useSelectionStore((s) => s.selectedSiteId)

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

  return (
    <ReactFlowProvider>
      <PhysicalCanvasInner siteId={selectedSiteId} />
    </ReactFlowProvider>
  )
}
