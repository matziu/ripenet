import { cn } from '@/lib/utils'

/** Calculate usable host count from CIDR notation (e.g. "10.0.0.0/24") */
export function getUsableHosts(network: string): number {
  const match = network.match(/\/(\d+)$/)
  if (!match) return 0
  const prefix = parseInt(match[1], 10)
  if (prefix >= 32) return 1
  if (prefix === 31) return 2 // point-to-point
  return Math.pow(2, 32 - prefix) - 2
}

function getUtilColor(pct: number): string {
  if (pct >= 90) return 'bg-red-500'
  if (pct >= 75) return 'bg-orange-500'
  if (pct >= 50) return 'bg-yellow-500'
  return 'bg-emerald-500'
}

function getUtilTextColor(pct: number): string {
  if (pct >= 90) return 'text-red-500'
  if (pct >= 75) return 'text-orange-500'
  if (pct >= 50) return 'text-yellow-500'
  return 'text-emerald-500'
}

interface SubnetUtilBarProps {
  network: string
  hostCount: number
  /** 'compact' = sidebar/table (thin bar + fraction), 'full' = detail panel (wider bar + %) */
  variant?: 'compact' | 'full'
  className?: string
}

export function SubnetUtilBar({ network, hostCount, variant = 'compact', className }: SubnetUtilBarProps) {
  const usable = getUsableHosts(network)
  if (usable === 0) return null
  const pct = Math.min(100, Math.round((hostCount / usable) * 100))
  const color = getUtilColor(pct)

  if (variant === 'full') {
    return (
      <div className={cn('space-y-1', className)}>
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">{hostCount} / {usable} hosts</span>
          <span className={cn('font-medium', getUtilTextColor(pct))}>{pct}%</span>
        </div>
        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all', color)}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    )
  }

  // compact
  return (
    <div className={cn('flex items-center gap-1', className)} title={`${hostCount}/${usable} hosts (${pct}%)`}>
      <div className="h-1.5 w-8 rounded-full bg-muted overflow-hidden shrink-0">
        <div
          className={cn('h-full rounded-full', color)}
          style={{ width: `${Math.max(pct, 4)}%` }}
        />
      </div>
      <span className={cn('text-[10px] tabular-nums', getUtilTextColor(pct))}>{pct}%</span>
    </div>
  )
}
