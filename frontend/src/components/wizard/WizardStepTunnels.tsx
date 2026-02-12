import { useEffect } from 'react'
import { ArrowLeftRight } from 'lucide-react'
import type { WizardState } from '@/lib/wizard.types'
import type { TunnelType } from '@/types'
import { generateFullMeshTunnels, generateHubSpokeTunnels } from '@/lib/wizard.utils'

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

export function WizardStepTunnels({ state, onChange, onNext, onBack }: Props) {
  const canTunnel = state.sites.length >= 2

  const regenerate = (
    mode: WizardState['tunnelMode'],
    type: TunnelType,
    base: string,
    hub?: string,
  ) => {
    if (mode === 'none' || !base) {
      onChange({ tunnelPlan: [] })
      return
    }
    const pairs =
      mode === 'full-mesh'
        ? generateFullMeshTunnels(state.sites, base, type)
        : generateHubSpokeTunnels(state.sites, hub ?? state.sites[0]?.tempId, base, type)
    onChange({ tunnelPlan: pairs })
  }

  // Auto-regenerate when dependencies change
  useEffect(() => {
    if (state.tunnelMode !== 'none' && state.tunnelSubnetBase) {
      regenerate(state.tunnelMode, state.tunnelType, state.tunnelSubnetBase, state.hubSiteTempId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.tunnelMode, state.tunnelType, state.tunnelSubnetBase, state.hubSiteTempId])

  const getSiteName = (tempId: string) =>
    state.sites.find((s) => s.tempId === tempId)?.name ?? tempId

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">Tunnel Topology</h2>
        <p className="text-sm text-muted-foreground">
          Configure site-to-site tunnels. Point-to-point /30 subnets will be allocated from a
          separate tunnel address block.
        </p>
      </div>

      {!canTunnel && (
        <div className="rounded-md border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
          At least 2 sites are needed for tunnel configuration. You can skip this step.
        </div>
      )}

      {canTunnel && (
        <>
          <div className="flex gap-3">
            {(['none', 'full-mesh', 'hub-spoke'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => onChange({ tunnelMode: mode, tunnelPlan: mode === 'none' ? [] : state.tunnelPlan })}
                className={`flex-1 rounded-md border px-4 py-3 text-sm font-medium transition-colors ${
                  state.tunnelMode === mode
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:bg-accent'
                }`}
              >
                {mode === 'none' ? 'No Tunnels' : mode === 'full-mesh' ? 'Full Mesh' : 'Hub & Spoke'}
              </button>
            ))}
          </div>

          {state.tunnelMode !== 'none' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
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
                <div>
                  <label className="text-xs font-medium">Tunnel Subnet Block</label>
                  <input
                    value={state.tunnelSubnetBase}
                    onChange={(e) => onChange({ tunnelSubnetBase: e.target.value })}
                    placeholder="e.g. 172.16.0.0/24"
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm font-mono"
                  />
                </div>
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
