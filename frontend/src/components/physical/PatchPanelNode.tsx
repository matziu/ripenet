import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import { useSelectionStore } from '@/stores/selection.store'
import { useUIStore } from '@/stores/ui.store'
import { Grid3X3 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PhysicalPatchPanel } from '@/types'

export interface PatchPanelNodeData extends PhysicalPatchPanel {
  connectedPorts: Set<number>
  [key: string]: unknown
}

export const PP_NODE_WIDTH = 220
export const PP_NODE_HEADER_HEIGHT = 48
export const PP_NODE_PORT_HEIGHT = 24

export const PatchPanelNode = memo(function PatchPanelNode({ data }: NodeProps) {
  const d = data as PatchPanelNodeData
  const setSelectedPatchPanel = useSelectionStore((s) => s.setSelectedPatchPanel)
  const toggleDetailPanel = useUIStore((s) => s.toggleDetailPanel)
  const detailPanelOpen = useUIStore((s) => s.detailPanelOpen)

  const handleClick = () => {
    setSelectedPatchPanel(d.id)
    if (!detailPanelOpen) toggleDetailPanel()
  }

  return (
    <div
      className={cn(
        'rounded-xl border border-border/60 bg-card shadow-md cursor-pointer',
        'hover:border-amber-500/40 hover:shadow-lg transition-[border-color,box-shadow] duration-200',
      )}
      style={{ width: PP_NODE_WIDTH }}
      onClick={handleClick}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 px-3 py-2 bg-gradient-to-r from-amber-500/8 via-amber-500/4 to-transparent rounded-t-xl">
        <div className="flex items-center justify-center h-7 w-7 rounded-lg shrink-0 bg-amber-500/15">
          <Grid3X3 className="h-3.5 w-3.5 text-amber-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-semibold truncate">{d.name}</div>
          <div className="text-[10px] text-muted-foreground">
            {d.ports.length} ports
          </div>
        </div>
      </div>

      {/* Ports */}
      {d.ports.length > 0 && (
        <div className="border-t border-border/30 px-1.5 py-1.5 space-y-0.5">
          {d.ports.map((port) => {
            const isConnected = d.connectedPorts.has(port.id)
            return (
              <div
                key={port.id}
                className="relative flex items-center gap-1.5 py-0.5"
              >
                <Handle
                  type="source"
                  position={Position.Left}
                  id={`port-${port.id}-left`}
                  className={cn(
                    '!w-2 !h-2 !border-2 !left-[-5px]',
                    isConnected
                      ? '!bg-amber-500 !border-amber-400'
                      : '!bg-muted-foreground/20 !border-muted-foreground/10',
                  )}
                  style={{ top: 'auto', position: 'absolute' }}
                />
                <div className="flex-1 flex items-center justify-center gap-1.5 px-3">
                  <span
                    className={cn(
                      'text-[10px] truncate',
                      isConnected ? 'text-foreground font-medium' : 'text-muted-foreground/50',
                    )}
                  >
                    {port.name}
                  </span>
                  <span
                    className={cn(
                      'text-[8px] uppercase',
                      isConnected ? 'text-muted-foreground' : 'text-muted-foreground/30',
                    )}
                  >
                    {port.port_type}
                  </span>
                </div>
                <Handle
                  type="source"
                  position={Position.Right}
                  id={`port-${port.id}-right`}
                  className={cn(
                    '!w-2 !h-2 !border-2 !right-[-5px]',
                    isConnected
                      ? '!bg-amber-500 !border-amber-400'
                      : '!bg-muted-foreground/20 !border-muted-foreground/10',
                  )}
                  style={{ top: 'auto', position: 'absolute' }}
                />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
})
