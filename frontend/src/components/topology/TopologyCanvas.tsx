import { useCallback, useEffect, useMemo } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type NodeTypes,
  type EdgeTypes,
  type OnNodesChange,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { useQuery } from '@tanstack/react-query'
import { projectsApi } from '@/api/endpoints'
import { useTopologyStore } from '@/stores/topology.store'
import { topologyToFlow, savePositions, loadPositions } from '@/lib/topology.utils'
import { SiteNode } from './nodes/SiteNode'
import { TunnelEdge } from './edges/TunnelEdge'

const nodeTypes: NodeTypes = {
  siteNode: SiteNode,
}

const edgeTypes: EdgeTypes = {
  tunnelEdge: TunnelEdge,
}

interface TopologyCanvasProps {
  projectId: number
}

export function TopologyCanvas({ projectId }: TopologyCanvasProps) {
  const expandedSites = useTopologyStore((s) => s.expandedSites)

  const { data: topology } = useQuery({
    queryKey: ['topology', projectId],
    queryFn: () => projectsApi.topology(projectId),
    select: (res) => res.data,
  })

  const savedPositions = useMemo(() => loadPositions(projectId), [projectId])

  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    if (!topology) return { nodes: [], edges: [] }
    return topologyToFlow(topology, expandedSites, savedPositions)
  }, [topology, expandedSites, savedPositions])

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  useEffect(() => {
    setNodes(initialNodes)
    setEdges(initialEdges)
  }, [initialNodes, initialEdges, setNodes, setEdges])

  const handleNodesChange: OnNodesChange = useCallback(
    (changes) => {
      onNodesChange(changes)
    },
    [onNodesChange],
  )

  const onNodeDragStop = useCallback(() => {
    savePositions(projectId, nodes)
  }, [projectId, nodes])

  if (!topology) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Loading topology...
      </div>
    )
  }

  if (topology.sites.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <div className="text-center">
          <p className="text-lg font-medium">No sites yet</p>
          <p className="text-sm mt-1">Add sites to this project to see the topology</p>
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
      <Background gap={20} size={1} />
      <Controls className="!bg-card !border-border !shadow-md" />
      <MiniMap
        className="!bg-card !border-border"
        nodeColor="#3b82f6"
        maskColor="rgba(0, 0, 0, 0.1)"
      />
    </ReactFlow>
  )
}
