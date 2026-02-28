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
  portSide: 'left' | 'right'
  color?: string
  device_type_label?: string
  [key: string]: unknown
}

export const HOST_NODE_WIDTH = 220
export const HOST_NODE_HEADER_HEIGHT = 68
export const HOST_NODE_PORT_HEIGHT = 24

export const HostNode = memo(function HostNode({ data }: NodeProps) {
  const d = data as HostNodeData
  const setSelectedHost = useSelectionStore((s) => s.setSelectedHost)
  const toggleDetailPanel = useUIStore((s) => s.toggleDetailPanel)
  const detailPanelOpen = useUIStore((s) => s.detailPanelOpen)

  const color = d.color || '#3b82f6'

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
      <div
        className="flex items-center gap-2.5 px-3 py-2.5 rounded-t-xl"
        style={{ background: `linear-gradient(to right, ${color}14, ${color}08, transparent)` }}
      >
        <div
          className="flex items-center justify-center h-7 w-7 rounded-lg shrink-0"
          style={{ backgroundColor: `${color}26` }}
        >
          <Server className="h-3.5 w-3.5" style={{ color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[12px] font-semibold truncate">{d.hostname || 'Unnamed'}</div>
          <div className="text-[10px] font-mono text-muted-foreground truncate">{d.ip_address}</div>
          {d.device_type && (
            <span
              className="inline-block rounded px-1 py-0 text-[9px] font-bold uppercase border mt-0.5"
              style={{ backgroundColor: `${color}1a`, color, borderColor: `${color}33` }}
            >
              {d.device_type_label || d.device_type}
            </span>
          )}
        </div>
      </div>

      {/* Ports */}
      {d.ports.length > 0 && (
        <div className="border-t border-border/30 px-1.5 py-1.5 space-y-0.5">
          {d.ports.map((port) => {
            const isConnected = d.connectedPorts.has(port.id)
            const onLeft = d.portSide === 'left'
            const pos = onLeft ? Position.Left : Position.Right
            const posCls = onLeft ? '!left-[-5px]' : '!right-[-5px]'
            return (
              <div
                key={port.id}
                className={cn(
                  'relative flex items-center gap-1.5 py-0.5',
                  onLeft ? 'flex-row-reverse justify-end pl-3' : 'justify-end pr-3',
                )}
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
                  position={pos}
                  id={`port-${port.id}`}
                  className={cn(
                    '!w-2 !h-2 !border-2',
                    posCls,
                    !isConnected && '!bg-muted-foreground/20 !border-muted-foreground/10',
                  )}
                  style={{
                    top: 'auto',
                    position: 'absolute',
                    ...(isConnected ? { backgroundColor: color, borderColor: color } : {}),
                  }}
                />
                <Handle
                  type="target"
                  position={pos}
                  id={`port-${port.id}`}
                  className={cn('!w-2 !h-2 !bg-transparent !border-0', posCls)}
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
