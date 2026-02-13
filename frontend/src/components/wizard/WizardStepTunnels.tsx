import { useEffect, useMemo, useState } from 'react'
import { ArrowLeftRight, AlertTriangle, Trash2 } from 'lucide-react'
import type { WizardState } from '@/lib/wizard.types'
import type { TunnelType } from '@/types'
import {
  generateFullMeshTunnels,
  generateHubSpokeTunnels,
  computeTunnelCount,
  computeMinTunnelBlock,
  suggestTunnelBlock,
  generatePointToPointSlots,
  validateManualTunnel,
  computeManualTunnelIPs,
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

function IconManual() {
  return (
    <svg width="48" height="40" viewBox="0 0 48 40" fill="none" className="mx-auto mb-1">
      <circle cx="12" cy="20" r="4" fill="currentColor" opacity={0.7} />
      <circle cx="36" cy="20" r="4" fill="currentColor" opacity={0.7} />
      <line x1="16" y1="20" x2="32" y2="20" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2" opacity={0.4} />
      {/* pencil indicator */}
      <line x1="34" y1="8" x2="40" y2="2" stroke="currentColor" strokeWidth="1.5" opacity={0.6} />
      <line x1="33" y1="9" x2="35" y2="7" stroke="currentColor" strokeWidth="1.5" opacity={0.6} />
    </svg>
  )
}

/* ------------------------------------------------------------------ */

export function WizardStepTunnels({ state, onChange, onNext, onBack }: Props) {
  const canTunnel = state.sites.length >= 2
  const ptp = state.tunnelPointToPointPrefix
  const allocStart = state.tunnelAllocStart ?? 'end'

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
    if (state.tunnelMode === 'none' || state.tunnelMode === 'manual') return
    if (state.tunnelAllocMode === 'manual') return
    const suggested = suggestTunnelBlock(state.supernet, tunnelCount, ptp, state.tunnelAllocMode, allocStart)
    if (suggested && suggested !== state.tunnelSubnetBase) {
      onChange({ tunnelSubnetBase: suggested })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.tunnelAllocMode, allocStart, state.tunnelMode, tunnelCount, ptp, state.supernet])

  // Auto-regenerate when dependencies change
  useEffect(() => {
    if (state.tunnelMode !== 'none' && state.tunnelMode !== 'manual' && state.tunnelSubnetBase) {
      regenerate(state.tunnelMode, state.tunnelType, state.tunnelSubnetBase, state.hubSiteTempId, ptp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.tunnelMode, state.tunnelType, state.tunnelSubnetBase, state.hubSiteTempId, ptp])

  const getSiteName = (tempId: string) =>
    state.sites.find((s) => s.tempId === tempId)?.name ?? tempId

  // Manual mode local state
  const [manualSiteA, setManualSiteA] = useState('')
  const [manualSiteB, setManualSiteB] = useState('')
  const [manualCidr, setManualCidr] = useState('')
  const [manualError, setManualError] = useState<string | null>(null)

  const handleAddManualTunnel = () => {
    const err = validateManualTunnel(manualCidr, state.addressPlan, state.tunnelPlan)
    if (err) { setManualError(err); return }
    const ips = computeManualTunnelIPs(manualCidr)
    if (!ips) { setManualError('Could not compute IPs'); return }
    const siteAName = getSiteName(manualSiteA)
    const siteBName = getSiteName(manualSiteB)
    const entry = {
      siteATempId: manualSiteA,
      siteBTempId: manualSiteB,
      tunnelSubnet: manualCidr,
      ipA: ips.ipA,
      ipB: ips.ipB,
      name: `${state.tunnelType}-${siteAName}-${siteBName}`,
    }
    onChange({ tunnelPlan: [...state.tunnelPlan, entry] })
    setManualSiteA('')
    setManualSiteB('')
    setManualCidr('')
    setManualError(null)
  }

  const handleDeleteTunnel = (idx: number) => {
    onChange({ tunnelPlan: state.tunnelPlan.filter((_, i) => i !== idx) })
  }

  const isAutoMode = state.tunnelMode === 'full-mesh' || state.tunnelMode === 'hub-spoke'

  const modeButtons: { value: WizardState['tunnelMode']; label: string; Icon: () => React.JSX.Element }[] = [
    { value: 'none', label: 'No Tunnels', Icon: IconNoTunnels },
    { value: 'full-mesh', label: 'Full Mesh', Icon: IconFullMesh },
    { value: 'hub-spoke', label: 'Hub & Spoke', Icon: IconHubSpoke },
    { value: 'manual', label: 'Manual', Icon: IconManual },
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
                onClick={() => {
                  // Clear tunnelPlan when switching to/from manual to prevent mixing entries
                  const clearPlan = value === 'none' || value === 'manual' || state.tunnelMode === 'manual'
                  onChange({ tunnelMode: value, tunnelPlan: clearPlan ? [] : state.tunnelPlan })
                }}
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
              {/* Tunnel Type selector — shared by all non-none modes */}
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

              {/* ---- Auto mode controls (full-mesh / hub-spoke only) ---- */}
              {isAutoMode && (
                <>
                  {/* Point-to-point prefix selector */}
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

                  {/* Allocation mode */}
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

                  {/* Allocation direction (start/end) — only for auto modes */}
                  {state.tunnelAllocMode !== 'manual' && (
                    <div>
                      <label className="text-xs font-medium">Allocation Direction</label>
                      <div className="mt-1 flex gap-2">
                        {([
                          { value: 'start' as const, label: 'Start' },
                          { value: 'end' as const, label: 'End' },
                        ]).map((d) => (
                          <button
                            key={d.value}
                            type="button"
                            onClick={() => onChange({ tunnelAllocStart: d.value })}
                            className={`flex-1 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                              allocStart === d.value
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-border hover:bg-accent'
                            }`}
                          >
                            {d.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Manual CIDR input (for tunnelAllocMode=manual, not tunnelMode=manual) */}
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
                </>
              )}

              {/* ---- Manual mode: Add Tunnel form ---- */}
              {state.tunnelMode === 'manual' && (
                <div className="rounded-md border border-border p-4 space-y-3">
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Add Tunnel
                  </h3>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-xs font-medium">Site A</label>
                      <select
                        value={manualSiteA}
                        onChange={(e) => { setManualSiteA(e.target.value); setManualError(null) }}
                        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                      >
                        <option value="">Select site...</option>
                        {state.sites.map((s) => (
                          <option key={s.tempId} value={s.tempId}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium">Site B</label>
                      <select
                        value={manualSiteB}
                        onChange={(e) => { setManualSiteB(e.target.value); setManualError(null) }}
                        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                      >
                        <option value="">Select site...</option>
                        {state.sites.filter((s) => s.tempId !== manualSiteA).map((s) => (
                          <option key={s.tempId} value={s.tempId}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-medium">Tunnel Subnet</label>
                      <input
                        value={manualCidr}
                        onChange={(e) => { setManualCidr(e.target.value); setManualError(null) }}
                        placeholder="e.g. 10.255.0.0/30"
                        className={`mt-1 w-full rounded-md border bg-background px-3 py-1.5 text-sm font-mono ${
                          manualError ? 'border-red-500' : 'border-input'
                        }`}
                      />
                    </div>
                  </div>
                  {manualError && (
                    <p className="text-xs text-red-500">{manualError}</p>
                  )}
                  <button
                    type="button"
                    disabled={!manualSiteA || !manualSiteB || !manualCidr}
                    onClick={handleAddManualTunnel}
                    className="rounded-md bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Add Tunnel
                  </button>
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
                        {state.tunnelMode === 'manual' && (
                          <button
                            type="button"
                            onClick={() => handleDeleteTunnel(idx)}
                            className="ml-1 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
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
