import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import type { NodeProps } from '@xyflow/react'
import { useSelectionStore } from '@/stores/selection.store'
import { useUIStore } from '@/stores/ui.store'
import { Server } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PhysicalHost } from '@/types'

export interface HostNodeData extends PhysicalHost {
  connectedPorts: Set<number>
  [key: string]: unknown
}

export const HOST_NODE_WIDTH = 220
export const HOST_NODE_HEADER_HEIGHT = 56
export const HOST_NODE_PORT_HEIGHT = 24

export const HostNode = memo(function HostNode({ data }: NodeProps) {
  const d = data as HostNodeData
  const setSelectedHost = useSelectionStore((s) => s.setSelectedHost)
  const toggleDetailPanel = useUIStore((s) => s.toggleDetailPanel)
  const detailPanelOpen = useUIStore((s) => s.detailPanelOpen)

  const handleClick = () => {
    setSelectedHost(d.id)
    if (!detailPanelOpen) toggleDetailPanel()
  }

  return (
    <div
      className={cn(
        'rounded-xl border border-border/60 bg-card shadow-md cursor-pointer',
        'hover:border-primary/40 hover:shadow-lg transition-[border-color,box-shadow] duration-200',
      )}
      style={{ width: HOST_NODE_WIDTH }}
      onClick={handleClick}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 px-3 py-2.5 bg-gradient-to-r from-blue-500/8 via-blue-500/4 to-transparent rounded-t-xl">
        <div className="flex items-center justify-center h-7 w-7 rounded-lg shrink-0 bg-blue-500/15">
          <Server className="h-3.5 w-3.5 text-blue-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-semibold truncate">{d.hostname || 'Unnamed'}</div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-[10px] font-mono text-muted-foreground truncate">{d.ip_address}</span>
            {d.device_type && (
              <span className="shrink-0 rounded px-1 py-0 text-[8px] font-bold uppercase bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                {d.device_type}
              </span>
            )}
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
                className="relative flex items-center justify-end gap-1.5 pr-3 py-0.5"
              >
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
                <Handle
                  type="source"
                  position={Position.Right}
                  id={`port-${port.id}`}
                  className={cn(
                    '!w-2 !h-2 !border-2 !right-[-5px]',
                    isConnected
                      ? '!bg-blue-500 !border-blue-400'
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
