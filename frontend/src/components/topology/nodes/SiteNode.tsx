import { memo, useRef, useState, useEffect } from 'react'
import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import { useNavigate } from 'react-router-dom'
import type { SiteNodeData, VlanEmbedded } from '@/lib/topology.utils'
import { getVlanColor } from '@/lib/topology.utils'
import { useTopologyStore } from '@/stores/topology.store'
import { useSelectionStore } from '@/stores/selection.store'
import { useUIStore } from '@/stores/ui.store'
import { Building2, ChevronRight, Globe, Network, Cloud, ExternalLink } from 'lucide-react'
import { SubnetUtilBar } from '@/components/shared/SubnetUtilBar'
import { cn } from '@/lib/utils'

function VlanRow({ vlan, index }: { vlan: VlanEmbedded; index: number }) {
  const setSelectedVlan = useTopologyStore((s) => s.setSelectedVlan)
  const setSelectionVlan = useSelectionStore((s) => s.setSelectedVlan)
  const toggleDetailPanel = useUIStore((s) => s.toggleDetailPanel)
  const detailPanelOpen = useUIStore((s) => s.detailPanelOpen)
  const highlightedNodeId = useTopologyStore((s) => s.highlightedNodeId)
  const isHighlighted = highlightedNodeId === `vlan-${vlan.id}`

  const color = getVlanColor(vlan.purpose, vlan.colorIndex)

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedVlan(vlan.id)
    setSelectionVlan(vlan.id)
    if (!detailPanelOpen) toggleDetailPanel()
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer',
        'transition-all duration-150',
        index >= 0 && 'opacity-0 animate-[vlan-slide-in_0.25s_ease-out_forwards]',
        color.bg,
        color.border,
        'border',
        isHighlighted && 'ring-2 ring-primary/40 shadow-sm',
        'hover:brightness-95 dark:hover:brightness-110',
      )}
      style={index >= 0 ? { animationDelay: `${index * 30}ms` } : undefined}
      onClick={handleClick}
    >
      <div className={cn('w-2 h-2 rounded-full shrink-0', color.dot)} />
      <div className="flex-1 min-w-0 flex items-center justify-between gap-1">
        <div className="min-w-0">
          <span className={cn('text-[11px] font-semibold', color.text)}>
            VLAN {vlan.vlanId}
          </span>
          <span className="text-[10px] text-muted-foreground ml-1.5">{vlan.name}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {vlan.subnetDetails.length > 0 && (
            <SubnetUtilBar
              network={vlan.subnetDetails[0].network}
              hostCount={vlan.subnetDetails[0].hostCount}
            />
          )}
        </div>
      </div>
    </div>
  )
}

export const SiteNode = memo(function SiteNode({ data, id }: NodeProps) {
  const d = data as SiteNodeData
  const toggleExpandedSite = useTopologyStore((s) => s.toggleExpandedSite)
  const setSelectedSite = useSelectionStore((s) => s.setSelectedSite)
  const expandSite = useSelectionStore((s) => s.toggleExpandedSite)
  const expandedSiteIds = useSelectionStore((s) => s.expandedSiteIds)
  const toggleDetailPanel = useUIStore((s) => s.toggleDetailPanel)
  const detailPanelOpen = useUIStore((s) => s.detailPanelOpen)
  const highlightedNodeId = useTopologyStore((s) => s.highlightedNodeId)
  const isHighlighted = highlightedNodeId === id

  const navigate = useNavigate()
  const isVirtual = d.isExternal || d.isCrossProject

  // ── Expand/collapse animation state ──
  const [isOpen, setIsOpen] = useState(d.expanded)
  const [shouldRender, setShouldRender] = useState(d.expanded)

  // Cache vlans/subnets so content stays visible during collapse animation
  const cachedVlansRef = useRef(d.vlans)
  const cachedStandaloneRef = useRef(d.standaloneSubnets)
  if (d.vlans.length > 0) {
    cachedVlansRef.current = d.vlans
    cachedStandaloneRef.current = d.standaloneSubnets
  }

  const displayVlans = d.vlans.length > 0 ? d.vlans : cachedVlansRef.current
  const displayStandalone = d.standaloneSubnets.length > 0 ? d.standaloneSubnets : cachedStandaloneRef.current
  const hasAnyContent = displayVlans.length > 0 || (displayStandalone?.length ?? 0) > 0

  useEffect(() => {
    if (d.expanded) {
      // Expand: render grid at 0fr first, then animate to 1fr on next frame
      setShouldRender(true)
      const raf = requestAnimationFrame(() => {
        setIsOpen(true)
      })
      return () => cancelAnimationFrame(raf)
    } else {
      // Collapse: animate 1fr → 0fr, then remove from DOM
      setIsOpen(false)
      const timer = setTimeout(() => setShouldRender(false), 320)
      return () => clearTimeout(timer)
    }
  }, [d.expanded])

  const handleSiteClick = () => {
    if (d.isCrossProject && d.crossProjectId) {
      navigate(`/projects/${d.crossProjectId}/topology`)
      return
    }
    if (d.isExternal) return
    toggleExpandedSite(d.siteId)
    setSelectedSite(d.siteId)
    if (!expandedSiteIds.has(d.siteId)) expandSite(d.siteId)
    if (!detailPanelOpen) toggleDetailPanel()
  }

  // Pick icon and color scheme based on node type
  const NodeIcon = d.isExternal ? ExternalLink : d.isCrossProject ? Cloud : Building2
  const gradientClasses = d.isExternal
    ? 'from-orange-500/10 via-orange-500/5 to-transparent dark:from-orange-500/20 dark:via-orange-500/10 dark:to-transparent'
    : d.isCrossProject
      ? 'from-amber-500/10 via-amber-500/5 to-transparent dark:from-amber-500/20 dark:via-amber-500/10 dark:to-transparent'
      : 'from-primary/5 via-primary/3 to-transparent dark:from-primary/10 dark:via-primary/5 dark:to-transparent'
  const iconBgClasses = d.isExternal
    ? 'bg-orange-500/15 dark:bg-orange-500/25'
    : d.isCrossProject
      ? 'bg-amber-500/15 dark:bg-amber-500/25'
      : 'bg-primary/10 dark:bg-primary/20'
  const iconColorClass = d.isExternal
    ? 'text-orange-500'
    : d.isCrossProject
      ? 'text-amber-500'
      : 'text-primary'
  const borderClasses = d.isExternal
    ? 'border-orange-500/40 hover:border-orange-500/60'
    : d.isCrossProject
      ? 'border-amber-500/40 hover:border-amber-500/60'
      : 'border-border/60 hover:border-primary/40 hover:shadow-lg'

  return (
    <div
      className={cn(
        'w-[260px] rounded-xl border bg-card shadow-md',
        'transition-[border-color,box-shadow] duration-200',
        isVirtual && 'border-dashed',
        isHighlighted
          ? 'border-primary ring-2 ring-primary/30 shadow-lg shadow-primary/10'
          : borderClasses,
      )}
    >
      <Handle type="target" id="target-top" position={Position.Top} className="!w-1.5 !h-1.5 !opacity-0" />
      <Handle type="target" id="target-left" position={Position.Left} className="!w-1.5 !h-1.5 !opacity-0" />
      <Handle type="source" id="source-top" position={Position.Top} className="!w-1.5 !h-1.5 !opacity-0" />
      <Handle type="source" id="source-left" position={Position.Left} className="!w-1.5 !h-1.5 !opacity-0" />

      {/* Site header with gradient */}
      <div
        className={cn(
          'flex items-center gap-3 px-4 py-3 rounded-t-xl',
          d.isExternal ? 'cursor-default' : 'cursor-pointer',
          'bg-gradient-to-r',
          gradientClasses,
          'group',
        )}
        onClick={handleSiteClick}
      >
        <div className={cn(
          'flex items-center justify-center h-8 w-8 rounded-lg shrink-0',
          'transition-all duration-200',
          iconBgClasses,
          isHighlighted && 'brightness-110',
          !isVirtual && 'group-hover:scale-110',
        )}>
          <NodeIcon className={cn('h-4 w-4 transition-colors duration-200', iconColorClass)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-sm truncate">{d.label}</span>
            {d.isExternal && (
              <span className="shrink-0 rounded px-1 py-0.5 text-[8px] font-bold uppercase bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/30">
                EXT
              </span>
            )}
            {d.isCrossProject && (
              <span className="shrink-0 rounded px-1 py-0.5 text-[8px] font-bold uppercase bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                XP
              </span>
            )}
            {!isVirtual && (
              <ChevronRight
                className={cn(
                  'h-3.5 w-3.5 text-muted-foreground/60 transition-transform duration-300 ease-out',
                  d.expanded && 'rotate-90',
                )}
              />
            )}
          </div>
          {!isVirtual && (
            <div className="flex gap-3 text-[10px] text-muted-foreground mt-0.5">
              <span className="flex items-center gap-0.5">
                <Network className="h-3 w-3" />
                {d.vlanCount}
              </span>
              <span>{d.hostCount} hosts</span>
            </div>
          )}
          {d.isExternal && (
            <div className="text-[10px] text-orange-500/70 mt-0.5">External endpoint</div>
          )}
          {d.isCrossProject && (
            <div className="text-[10px] text-amber-500/70 mt-0.5">Cross-project site</div>
          )}
        </div>
      </div>

      {/* WAN Addresses — always visible */}
      {d.wanAddresses.length > 0 && (
        <div className="px-4 pb-1.5 pt-0.5 space-y-0.5">
          {d.wanAddresses.map((wan, i) => (
            <div key={i} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <Globe className="h-3 w-3 shrink-0 text-sky-500/70" />
              <span className="font-mono">{wan.ip_address}</span>
              <span className="text-[9px] opacity-60">{wan.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Animated expand/collapse using CSS grid-template-rows */}
      {shouldRender && hasAnyContent && (
        <div
          style={{
            display: 'grid',
            gridTemplateRows: isOpen ? '1fr' : '0fr',
            transition: 'grid-template-rows 300ms cubic-bezier(0.4,0,0.2,1)',
          }}
        >
          <div style={{ overflow: 'hidden' }}>
            <div className="px-3 pb-3 space-y-1 border-t border-border/30 pt-2 mt-0.5">
              {displayVlans.map((vlan, i) => (
                <VlanRow key={vlan.id} vlan={vlan} index={isOpen ? i : -1} />
              ))}
              {displayStandalone && displayStandalone.length > 0 && (
                <>
                  {displayVlans.length > 0 && (
                    <div className="text-[9px] uppercase tracking-wider text-muted-foreground/60 pt-1">
                      Standalone
                    </div>
                  )}
                  {displayStandalone.map((sub, i) => (
                    <div
                      key={i}
                      className={cn(
                        'flex items-center gap-2 rounded-md px-2 py-1 bg-gray-500/10 border border-gray-500/20',
                        isOpen && 'opacity-0 animate-[vlan-slide-in_0.25s_ease-out_forwards]',
                      )}
                      style={isOpen ? { animationDelay: `${(displayVlans.length + i) * 30}ms` } : undefined}
                    >
                      <div className="w-2 h-2 rounded-full shrink-0 bg-gray-400" />
                      <span className="text-[11px] font-mono text-muted-foreground">{sub.network}</span>
                      <SubnetUtilBar network={sub.network} hostCount={sub.hostCount} className="ml-auto" />
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <Handle type="target" id="target-bottom" position={Position.Bottom} className="!w-1.5 !h-1.5 !opacity-0" />
      <Handle type="target" id="target-right" position={Position.Right} className="!w-1.5 !h-1.5 !opacity-0" />
      <Handle type="source" id="source-bottom" position={Position.Bottom} className="!w-1.5 !h-1.5 !opacity-0" />
      <Handle type="source" id="source-right" position={Position.Right} className="!w-1.5 !h-1.5 !opacity-0" />
    </div>
  )
})
