import { useEffect, useMemo } from 'react'
import { ArrowLeftRight, AlertTriangle } from 'lucide-react'
import type { WizardState } from '@/lib/wizard.types'
import type { TunnelType } from '@/types'
import {
  generateFullMeshTunnels,
  generateHubSpokeTunnels,
  computeTunnelCount,
  computeMinTunnelBlock,
  suggestTunnelBlock,
  generatePointToPointSlots,
} from '@/lib/wizard.utils'

interface Props {
  state: WizardState
  onChange: (patch: Partial<WizardState>) => void
  onNext: () => void
  onBack: () => void
}

const tunnelTypes: { value: TunnelType; label: string }[] = [
  { value: 'wireguard', label: 'WireGuard' },
  { value: 'ipsec', label: 'IPsec' },
  { value: 'gre', label: 'GRE' },
  { value: 'vxlan', label: 'VXLAN' },
]

/* ------------------------------------------------------------------ */
/* Inline SVG infographic icons for tunnel modes                      */
/* ------------------------------------------------------------------ */

function IconNoTunnels() {
  return (
    <svg width="48" height="32" viewBox="0 0 48 32" fill="none" className="mx-auto mb-1">
      <circle cx="10" cy="16" r="4" fill="currentColor" opacity={0.3} />
      <circle cx="24" cy="16" r="4" fill="currentColor" opacity={0.3} />
      <circle cx="38" cy="16" r="4" fill="currentColor" opacity={0.3} />
      <line x1="6" y1="28" x2="42" y2="4" stroke="currentColor" strokeWidth="2" opacity={0.5} />
    </svg>
  )
}

function IconFullMesh() {
  return (
    <svg width="48" height="40" viewBox="0 0 48 40" fill="none" className="mx-auto mb-1">
      <line x1="24" y1="6" x2="8" y2="34" stroke="currentColor" strokeWidth="1.5" opacity={0.4} />
      <line x1="24" y1="6" x2="40" y2="34" stroke="currentColor" strokeWidth="1.5" opacity={0.4} />
      <line x1="8" y1="34" x2="40" y2="34" stroke="currentColor" strokeWidth="1.5" opacity={0.4} />
      <circle cx="24" cy="6" r="4" fill="currentColor" opacity={0.7} />
      <circle cx="8" cy="34" r="4" fill="currentColor" opacity={0.7} />
      <circle cx="40" cy="34" r="4" fill="currentColor" opacity={0.7} />
    </svg>
  )
}

function IconHubSpoke() {
  return (
    <svg width="48" height="40" viewBox="0 0 48 40" fill="none" className="mx-auto mb-1">
      <line x1="24" y1="18" x2="8" y2="6" stroke="currentColor" strokeWidth="1.5" opacity={0.4} />
      <line x1="24" y1="18" x2="40" y2="6" stroke="currentColor" strokeWidth="1.5" opacity={0.4} />
      <line x1="24" y1="18" x2="8" y2="34" stroke="currentColor" strokeWidth="1.5" opacity={0.4} />
      <line x1="24" y1="18" x2="40" y2="34" stroke="currentColor" strokeWidth="1.5" opacity={0.4} />
      <circle cx="24" cy="18" r="5" fill="currentColor" opacity={0.8} />
      <circle cx="8" cy="6" r="3" fill="currentColor" opacity={0.5} />
      <circle cx="40" cy="6" r="3" fill="currentColor" opacity={0.5} />
      <circle cx="8" cy="34" r="3" fill="currentColor" opacity={0.5} />
      <circle cx="40" cy="34" r="3" fill="currentColor" opacity={0.5} />
    </svg>
  )
}

/* ------------------------------------------------------------------ */

export function WizardStepTunnels({ state, onChange, onNext, onBack }: Props) {
  const canTunnel = state.sites.length >= 2
  const ptp = state.tunnelPointToPointPrefix

  const tunnelCount = useMemo(
    () => computeTunnelCount(state.sites, state.tunnelMode),
    [state.sites, state.tunnelMode],
  )

  const minPrefix = useMemo(
    () => computeMinTunnelBlock(tunnelCount, ptp),
    [tunnelCount, ptp],
  )

  // Available slots in the current block
  const availableSlots = useMemo(() => {
    if (!state.tunnelSubnetBase || !state.tunnelSubnetBase.includes('/')) return 0
    return generatePointToPointSlots(state.tunnelSubnetBase, ptp).length
  }, [state.tunnelSubnetBase, ptp])

  const blockTooSmall = state.tunnelMode !== 'none' && state.tunnelSubnetBase && availableSlots < tunnelCount

  const regenerate = (
    mode: WizardState['tunnelMode'],
    type: TunnelType,
    base: string,
    hub: string | undefined,
    ptpPfx: 30 | 31,
  ) => {
    if (mode === 'none' || !base) {
      onChange({ tunnelPlan: [] })
      return
    }
    const pairs =
      mode === 'full-mesh'
        ? generateFullMeshTunnels(state.sites, base, type, ptpPfx)
        : generateHubSpokeTunnels(state.sites, hub ?? state.sites[0]?.tempId, base, type, ptpPfx)
    onChange({ tunnelPlan: pairs })
  }

  // Auto-compute tunnelSubnetBase for non-manual modes
  useEffect(() => {
    if (state.tunnelMode === 'none') return
    if (state.tunnelAllocMode === 'manual') return
    const suggested = suggestTunnelBlock(state.supernet, tunnelCount, ptp, state.tunnelAllocMode)
    if (suggested && suggested !== state.tunnelSubnetBase) {
      onChange({ tunnelSubnetBase: suggested })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.tunnelAllocMode, state.tunnelMode, tunnelCount, ptp, state.supernet])

  // Auto-regenerate when dependencies change
  useEffect(() => {
    if (state.tunnelMode !== 'none' && state.tunnelSubnetBase) {
      regenerate(state.tunnelMode, state.tunnelType, state.tunnelSubnetBase, state.hubSiteTempId, ptp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.tunnelMode, state.tunnelType, state.tunnelSubnetBase, state.hubSiteTempId, ptp])

  const getSiteName = (tempId: string) =>
    state.sites.find((s) => s.tempId === tempId)?.name ?? tempId

  const modeButtons: { value: WizardState['tunnelMode']; label: string; Icon: () => React.JSX.Element }[] = [
    { value: 'none', label: 'No Tunnels', Icon: IconNoTunnels },
    { value: 'full-mesh', label: 'Full Mesh', Icon: IconFullMesh },
    { value: 'hub-spoke', label: 'Hub & Spoke', Icon: IconHubSpoke },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">Tunnel Topology</h2>
        <p className="text-sm text-muted-foreground">
          Configure site-to-site tunnels. Point-to-point subnets will be allocated automatically or
          from a manual address block.
        </p>
      </div>

      {!canTunnel && (
        <div className="rounded-md border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
          At least 2 sites are needed for tunnel configuration. You can skip this step.
        </div>
      )}

      {canTunnel && (
        <>
          {/* Tunnel mode selector with icons */}
          <div className="flex gap-3">
            {modeButtons.map(({ value, label, Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => onChange({ tunnelMode: value, tunnelPlan: value === 'none' ? [] : state.tunnelPlan })}
                className={`flex-1 rounded-md border px-4 py-3 text-sm font-medium transition-colors flex flex-col items-center ${
                  state.tunnelMode === value
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:bg-accent'
                }`}
              >
                <Icon />
                {label}
              </button>
            ))}
          </div>

          {state.tunnelMode !== 'none' && (
            <div className="space-y-4">
              {/* Row 1: Tunnel Type + Hub (if hub-spoke) */}
              <div className={`grid gap-3 ${state.tunnelMode === 'hub-spoke' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                <div>
                  <label className="text-xs font-medium">Tunnel Type</label>
                  <select
                    value={state.tunnelType}
                    onChange={(e) => onChange({ tunnelType: e.target.value as TunnelType })}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                  >
                    {tunnelTypes.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                {state.tunnelMode === 'hub-spoke' && (
                  <div>
                    <label className="text-xs font-medium">Hub Site</label>
                    <select
                      value={state.hubSiteTempId ?? ''}
                      onChange={(e) => onChange({ hubSiteTempId: e.target.value })}
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                    >
                      <option value="">Select hub...</option>
                      {state.sites.map((s) => (
                        <option key={s.tempId} value={s.tempId}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Row 2: Point-to-point prefix selector */}
              <div>
                <label className="text-xs font-medium">Point-to-Point Prefix</label>
                <div className="mt-1 flex gap-2">
                  {([30, 31] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => onChange({ tunnelPointToPointPrefix: p })}
                      className={`flex-1 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                        ptp === p
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border hover:bg-accent'
                      }`}
                    >
                      /{p} {p === 30 ? '(4 IPs per link)' : '(2 IPs per link — RFC 3021)'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Row 3: Allocation mode */}
              <div>
                <label className="text-xs font-medium">Subnet Allocation</label>
                <div className="mt-1 flex gap-2">
                  {([
                    { value: 'from-supernet' as const, label: 'From Supernet' },
                    { value: 'separate' as const, label: 'Separate Block' },
                    { value: 'manual' as const, label: 'Manual' },
                  ]).map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => onChange({ tunnelAllocMode: m.value })}
                      className={`flex-1 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                        state.tunnelAllocMode === m.value
                          ? 'border-primary bg-primary/10 text-primary'
                          : 'border-border hover:bg-accent'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Manual CIDR input */}
              {state.tunnelAllocMode === 'manual' && (
                <div>
                  <label className="text-xs font-medium">Tunnel Subnet Block</label>
                  <input
                    value={state.tunnelSubnetBase}
                    onChange={(e) => onChange({ tunnelSubnetBase: e.target.value })}
                    placeholder="e.g. 172.16.0.0/24"
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm font-mono"
                  />
                </div>
              )}

              {/* Auto-sizing info line */}
              {tunnelCount > 0 && (
                <div className="rounded-md border border-border bg-muted/50 px-4 py-2.5 text-sm">
                  <span className="text-muted-foreground">
                    {tunnelCount} tunnel{tunnelCount !== 1 ? 's' : ''} needed
                    {' → '}minimum /{minPrefix} block
                  </span>
                  {state.tunnelSubnetBase && state.tunnelAllocMode !== 'manual' && (
                    <span className="ml-2 font-mono font-medium">{state.tunnelSubnetBase}</span>
                  )}
                  {state.tunnelAllocMode === 'manual' && state.tunnelSubnetBase && (
                    <span className="ml-2 text-muted-foreground">
                      ({availableSlots} slot{availableSlots !== 1 ? 's' : ''} available)
                    </span>
                  )}
                </div>
              )}

              {/* Validation warning */}
              {blockTooSmall && (
                <div className="flex items-start gap-2 rounded-md border border-yellow-500/50 bg-yellow-500/10 px-4 py-2.5 text-sm text-yellow-700 dark:text-yellow-400">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>
                    Block too small: {availableSlots} slot{availableSlots !== 1 ? 's' : ''} available
                    but {tunnelCount} needed. Use at least a /{minPrefix} block.
                  </span>
                </div>
              )}

              {/* Tunnel plan table */}
              {state.tunnelPlan.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Tunnel Links ({state.tunnelPlan.length})
                  </h3>
                  <div className="space-y-1">
                    {state.tunnelPlan.map((t, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-3 rounded-md border border-border px-3 py-2 text-sm"
                      >
                        <span className="font-medium">{getSiteName(t.siteATempId)}</span>
                        <span className="font-mono text-xs text-muted-foreground">{t.ipA}</span>
                        <ArrowLeftRight className="h-4 w-4 text-muted-foreground shrink-0" />
                        <span className="font-mono text-xs text-muted-foreground">{t.ipB}</span>
                        <span className="font-medium">{getSiteName(t.siteBTempId)}</span>
                        <span className="ml-auto font-mono text-xs text-muted-foreground">
                          {t.tunnelSubnet}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      <div className="flex justify-between">
        <button
          type="button"
          onClick={onBack}
          className="rounded-md border border-border px-6 py-2 text-sm hover:bg-accent"
        >
          Back
        </button>
        <button
          type="button"
          onClick={onNext}
          className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Next
        </button>
      </div>
    </div>
  )
}
