import { useCallback, useEffect, useMemo, useState } from 'react'
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
  type OnNodesChange,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { useQuery } from '@tanstack/react-query'
import { projectsApi } from '@/api/endpoints'
import { useTopologyStore } from '@/stores/topology.store'
import { topologyToFlow, savePositions, loadPositions, clearPositions } from '@/lib/topology.utils'
import { SiteNode } from './nodes/SiteNode'
import { TunnelEdge } from './edges/TunnelEdge'
import { Dialog } from '@/components/ui/Dialog'
import { SiteForm } from '@/components/data/forms/SiteForm'
import { Building2, LayoutGrid, Network, Plus, MapPin, Server, Wand2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import type { ProjectTopology } from '@/types'

const nodeTypes: NodeTypes = {
  siteNode: SiteNode,
}

const edgeTypes: EdgeTypes = {
  tunnelEdge: TunnelEdge,
}

interface TopologyCanvasProps {
  projectId: number
}

const tunnelTypeInfo: Record<string, { color: string; label: string }> = {
  wireguard: { color: '#8b5cf6', label: 'WireGuard' },
  ipsec: { color: '#f59e0b', label: 'IPSec' },
  gre: { color: '#3b82f6', label: 'GRE' },
  vxlan: { color: '#06b6d4', label: 'VXLAN' },
}

function TopologyStats({ topology }: { topology: ProjectTopology }) {
  const totalVlans = topology.sites.reduce((sum, s) => sum + s.vlans.length, 0)
  const totalHosts = topology.sites.reduce(
    (sum, s) => sum + s.vlans.reduce((vs, v) => vs + v.subnets.reduce((ss, sub) => ss + sub.hosts.length, 0), 0),
    0,
  )

  return (
    <Panel position="top-left">
      <div className="flex items-center gap-3 rounded-lg border border-border/50 bg-card/90 backdrop-blur-sm px-3 py-1.5 shadow-sm text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <Building2 className="h-3 w-3" />
          {topology.sites.length}
        </span>
        <span className="flex items-center gap-1">
          <Network className="h-3 w-3" />
          {totalVlans}
        </span>
        <span className="flex items-center gap-1">
          <Server className="h-3 w-3" />
          {totalHosts}
        </span>
        {topology.tunnels.length > 0 && (
          <span className="text-muted-foreground/60">|</span>
        )}
        {topology.tunnels.length > 0 && (
          <span>{topology.tunnels.length} tunnels</span>
        )}
      </div>
    </Panel>
  )
}

function TunnelLegend({ topology }: { topology: ProjectTopology }) {
  const types = useMemo(() => {
    const seen = new Set<string>()
    for (const t of topology.tunnels) {
      seen.add(t.tunnel_type)
    }
    return Array.from(seen)
  }, [topology.tunnels])

  if (types.length === 0) return null

  return (
    <Panel position="bottom-right">
      <div className="rounded-lg border border-border/50 bg-card/90 backdrop-blur-sm px-3 py-2 shadow-sm">
        <div className="text-[9px] uppercase tracking-wider text-muted-foreground/60 mb-1.5">Tunnels</div>
        <div className="space-y-1">
          {types.map((type) => {
            const info = tunnelTypeInfo[type] ?? { color: '#94a3b8', label: type }
            return (
              <div key={type} className="flex items-center gap-2 text-[10px] text-muted-foreground">
                <div className="w-4 h-0.5 rounded-full" style={{ backgroundColor: info.color }} />
                <span>{info.label}</span>
              </div>
            )
          })}
        </div>
      </div>
    </Panel>
  )
}

function TopologyToolbar({ projectId, onRelayout }: { projectId: number; onRelayout: () => void }) {
  return (
    <Panel position="top-right">
      <button
        onClick={() => {
          clearPositions(projectId)
          onRelayout()
        }}
        className="flex items-center gap-1.5 rounded-lg border border-border/50 bg-card/90 backdrop-blur-sm px-2.5 py-1.5 text-xs font-medium text-foreground shadow-sm hover:bg-accent transition-colors"
      >
        <LayoutGrid className="h-3.5 w-3.5" />
        Re-layout
      </button>
    </Panel>
  )
}

function TopologyCanvasInner({ projectId }: TopologyCanvasProps) {
  const expandedSites = useTopologyStore((s) => s.expandedSites)
  const { fitView } = useReactFlow()
  const [layoutKey, setLayoutKey] = useState(0)

  const { data: topology } = useQuery({
    queryKey: ['topology', projectId],
    queryFn: () => projectsApi.topology(projectId),
    select: (res) => res.data,
  })

  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    if (!topology) return { nodes: [], edges: [] }
    // Always load fresh positions from localStorage
    // After "Re-layout" clearPositions() was called, so loadPositions returns undefined → triggers dagre
    const positions = loadPositions(projectId)
    return topologyToFlow(topology, expandedSites, positions)
    // layoutKey dependency: re-triggers after "Re-layout" button clears positions
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topology, expandedSites, projectId, layoutKey])

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  useEffect(() => {
    setNodes(initialNodes)
    setEdges(initialEdges)
    // Persist positions after every layout computation (dagre or position restore)
    // so that expand/collapse doesn't lose the current arrangement
    if (initialNodes.length > 0) {
      savePositions(projectId, initialNodes)
    }
  }, [initialNodes, initialEdges, setNodes, setEdges, projectId])

  const handleNodesChange: OnNodesChange = useCallback(
    (changes) => {
      onNodesChange(changes)
    },
    [onNodesChange],
  )

  const onNodeDragStop = useCallback(() => {
    savePositions(projectId, nodes)
  }, [projectId, nodes])

  const handleRelayout = useCallback(() => {
    setLayoutKey((k) => k + 1)
    // fitView after React has applied the new layout
    setTimeout(() => fitView({ duration: 300 }), 50)
  }, [fitView])

  if (!topology) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Loading topology...
      </div>
    )
  }

  if (topology.sites.length === 0) {
    return <EmptyProjectState projectId={projectId} />
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
      <TopologyStats topology={topology} />
      <TunnelLegend topology={topology} />
      <TopologyToolbar projectId={projectId} onRelayout={handleRelayout} />
    </ReactFlow>
  )
}

function EmptyProjectState({ projectId }: { projectId: number }) {
  const navigate = useNavigate()
  const [addSiteOpen, setAddSiteOpen] = useState(false)

  return (
    <div className="flex h-full items-center justify-center">
      <div className="text-center max-w-md space-y-4">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <MapPin className="h-8 w-8 text-muted-foreground" />
        </div>
        <div>
          <p className="text-lg font-semibold">No sites yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            Add your first site to start building the network topology, or use the wizard to set up a complete design.
          </p>
        </div>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => setAddSiteOpen(true)}
            className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Add Site
          </button>
          <button
            onClick={() => navigate('/wizard')}
            className="flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-accent transition-colors"
          >
            <Wand2 className="h-4 w-4" />
            Design Wizard
          </button>
        </div>
      </div>

      <Dialog open={addSiteOpen} onOpenChange={setAddSiteOpen} title="Add Site">
        <SiteForm projectId={projectId} onClose={() => setAddSiteOpen(false)} />
      </Dialog>
    </div>
  )
}

export function TopologyCanvas({ projectId }: TopologyCanvasProps) {
  return (
    <ReactFlowProvider>
      <TopologyCanvasInner projectId={projectId} />
    </ReactFlowProvider>
  )
}
