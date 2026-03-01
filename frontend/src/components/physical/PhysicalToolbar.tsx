import { Panel } from '@xyflow/react'
import { LayoutGrid } from 'lucide-react'
import { getCableColor } from './CableEdge'
import { PhysicalViewToggle } from './PhysicalTableView'

const cableTypeLabels: Record<string, string> = {
  fiber_sm: 'Fiber SM',
  fiber_mm: 'Fiber MM',
  cat6: 'Cat6',
  cat5e: 'Cat5e',
  cat6a: 'Cat6a',
  dac: 'DAC',
}

interface PhysicalToolbarProps {
  onRelayout: () => void
  visibleCableTypes: string[]
  viewMode: 'graph' | 'table'
  onViewModeChange: (mode: 'graph' | 'table') => void
}

export function PhysicalToolbar({ onRelayout, visibleCableTypes, viewMode, onViewModeChange }: PhysicalToolbarProps) {
  return (
    <>
      <Panel position="top-right">
        <div className="flex items-center gap-2">
          <PhysicalViewToggle viewMode={viewMode} onViewModeChange={onViewModeChange} />
          <button
            onClick={onRelayout}
            className="flex items-center gap-1.5 rounded-lg border border-border/50 bg-card/90 backdrop-blur-sm px-2.5 py-1.5 text-xs font-medium text-foreground shadow-sm hover:bg-accent transition-colors"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Re-layout
          </button>
        </div>
      </Panel>

      {visibleCableTypes.length > 0 && (
        <Panel position="bottom-right">
          <div className="rounded-lg border border-border/50 bg-card/90 backdrop-blur-sm px-3 py-2 shadow-sm">
            <div className="text-[9px] uppercase tracking-wider text-muted-foreground/60 mb-1.5">
              Cable Types
            </div>
            <div className="space-y-1">
              {visibleCableTypes.map((type) => {
                const color = getCableColor(type)
                const label = cableTypeLabels[type] ?? type
                return (
                  <div
                    key={type}
                    className="flex items-center gap-2 text-[10px] text-muted-foreground"
                  >
                    <div
                      className="w-4 h-0.5 rounded-full"
                      style={{ backgroundColor: color }}
                    />
                    <span>{label}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </Panel>
      )}
    </>
  )
}
