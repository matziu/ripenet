import { useState } from 'react'
import { RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { toolsApi } from '@/api/endpoints'
import type { WizardState, VLSMResult, VLSMAllocation } from '@/lib/wizard.types'
import {
  buildVlsmRequirements,
  buildAddressPlan,
  buildVlanAlignedPlan,
  validateVlanAligned,
  buildSequentialFixedPlan,
  validateSequentialFixed,
  buildSiteInOctetPlan,
  validateSiteInOctet,
  computeSubnetDetails,
  computeSiteSummaryRoutes,
  getVlanIdForSite,
} from '@/lib/wizard.utils'

interface Props {
  state: WizardState
  onChange: (patch: Partial<WizardState>) => void
  onNext: () => void
  onBack: () => void
}

const MODE_INFO: { mode: WizardState['addressingMode']; label: string; desc: string }[] = [
  { mode: 'vlsm', label: 'VLSM', desc: 'Optimal sizing based on host count' },
  { mode: 'vlan-aligned', label: 'VLAN-Aligned', desc: 'VLAN ID = 3rd octet (e.g. VLAN 100 \u2192 x.x.100.0)' },
  { mode: 'site-in-octet', label: 'Site-in-Octet', desc: '2nd octet = site index (requires /8 supernet)' },
  { mode: 'sequential-fixed', label: 'Sequential Fixed', desc: 'Equal-size subnets packed sequentially' },
]

export function WizardStepAddressPlan({ state, onChange, onNext, onBack }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mode = state.addressingMode

  const validationErrors = (() => {
    switch (mode) {
      case 'vlan-aligned': return validateVlanAligned(state)
      case 'site-in-octet': return validateSiteInOctet(state)
      case 'sequential-fixed': return validateSequentialFixed(state)
      default: return []
    }
  })()

  const calculate = async () => {
    if (mode === 'vlsm') {
      setLoading(true)
      setError(null)
      try {
        const requirements = buildVlsmRequirements(state)
        const res = await toolsApi.vlsm(state.supernet, requirements)
        const vlsmResult = res.data as VLSMResult
        const addressPlan = buildAddressPlan(state, vlsmResult)
        onChange({ vlsmResult, addressPlan })
      } catch (err: unknown) {
        const msg =
          err && typeof err === 'object' && 'response' in err
            ? String((err as { response: { data: { detail?: string } } }).response?.data?.detail ?? 'VLSM calculation failed')
            : 'VLSM calculation failed'
        setError(msg)
      } finally {
        setLoading(false)
      }
    } else {
      setError(null)
      if (validationErrors.length > 0) {
        setError(validationErrors.join('. '))
        return
      }
      let addressPlan
      switch (mode) {
        case 'vlan-aligned':
          addressPlan = buildVlanAlignedPlan(state)
          break
        case 'site-in-octet':
          addressPlan = buildSiteInOctetPlan(state)
          break
        case 'sequential-fixed':
          addressPlan = buildSequentialFixedPlan(state)
          break
      }
      onChange({ vlsmResult: undefined, addressPlan })
    }
  }

  const setMode = (m: WizardState['addressingMode']) => {
    onChange({ addressingMode: m, addressPlan: [], vlsmResult: undefined })
    setError(null)
  }

  const getSiteName = (tempId: string) =>
    state.sites.find((s) => s.tempId === tempId)?.name ?? tempId
  const getSiteIndex = (tempId: string) =>
    state.sites.findIndex((s) => s.tempId === tempId)
  const getVlanLabel = (vlanTempId: string, siteTempId: string) => {
    const tpl = state.vlanTemplates.find((t) => t.tempId === vlanTempId)
    if (!tpl) return vlanTempId
    const vid = getVlanIdForSite(tpl.vlanId, getSiteIndex(siteTempId), state)
    return `VLAN ${vid} - ${tpl.name}`
  }

  // Build lookup for VLSM host counts
  const allocByName = new Map<string, VLSMAllocation>()
  if (state.vlsmResult) {
    for (const a of state.vlsmResult.allocations) {
      allocByName.set(a.name, a)
    }
  }

  const hasResults = state.addressPlan.length > 0
  const summaryRoutes = hasResults ? computeSiteSummaryRoutes(state) : []

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">Address Plan</h2>
        <p className="text-sm text-muted-foreground">
          Choose an addressing strategy and generate subnet allocations from your
          supernet <span className="font-mono">{state.supernet}</span>.
        </p>
      </div>

      {/* Mode toggle — 2x2 grid */}
      <div className="grid grid-cols-2 gap-3">
        {MODE_INFO.map(({ mode: m, label, desc }) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`rounded-md border px-4 py-3 text-left transition-colors ${
              mode === m
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border hover:bg-accent'
            }`}
          >
            <div className="text-sm font-medium">{label}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
          </button>
        ))}
      </div>

      {/* VLAN-aligned options */}
      {mode === 'vlan-aligned' && (
        <div className="space-y-3">
          <div className="max-w-xs">
            <label className="text-xs font-medium">Subnet Prefix</label>
            <select
              value={state.vlanAlignedPrefix}
              onChange={(e) => onChange({ vlanAlignedPrefix: parseInt(e.target.value, 10), addressPlan: [] })}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm font-mono"
            >
              {[24, 25, 26, 27, 28].map((p) => (
                <option key={p} value={p}>/{p} ({Math.pow(2, 32 - p) - 2} hosts)</option>
              ))}
            </select>
          </div>

          {validationErrors.length === 0 && state.vlanTemplates.length > 0 && (
            <div className="text-xs text-muted-foreground space-y-0.5">
              <span className="font-medium">Addressing scheme:</span>
              {state.sites.map((site, idx) => {
                const [ipStr] = state.supernet.split('/')
                const parts = ipStr.split('.').map(Number)
                const baseNum = ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0
                const base16 = baseNum & 0xffff0000
                const perSite = state.vlanNumbering === 'per-site'
                const siteNum = perSite ? base16 : (base16 + (idx << 16)) >>> 0
                const o1 = (siteNum >>> 24) & 0xff
                const o2 = (siteNum >>> 16) & 0xff
                const firstTpl = state.vlanTemplates[0]
                const vid = getVlanIdForSite(firstTpl.vlanId, idx, state)
                return (
                  <div key={site.tempId} className="font-mono">
                    {site.name}: {o1}.{o2}.&#123;VID&#125;.0/{state.vlanAlignedPrefix}
                    {' '}(e.g. VLAN {vid} &rarr; {o1}.{o2}.{vid & 0xff}.0)
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Site-in-octet options */}
      {mode === 'site-in-octet' && (
        <div className="space-y-3">
          <div className="max-w-xs">
            <label className="text-xs font-medium">Subnet Prefix</label>
            <select
              value={state.vlanAlignedPrefix}
              onChange={(e) => onChange({ vlanAlignedPrefix: parseInt(e.target.value, 10), addressPlan: [] })}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm font-mono"
            >
              {[24, 25, 26, 27, 28].map((p) => (
                <option key={p} value={p}>/{p} ({Math.pow(2, 32 - p) - 2} hosts)</option>
              ))}
            </select>
          </div>

          {validationErrors.length === 0 && state.vlanTemplates.length > 0 && (
            <div className="text-xs text-muted-foreground space-y-0.5">
              <span className="font-medium">Addressing scheme:</span>
              {state.sites.map((site, idx) => {
                const firstOctet = parseInt(state.supernet.split('.')[0], 10)
                const firstTpl = state.vlanTemplates[0]
                const vid = getVlanIdForSite(firstTpl.vlanId, idx, state)
                return (
                  <div key={site.tempId} className="font-mono">
                    {site.name}: {firstOctet}.{idx + 1}.&#123;VID&#125;.0/{state.vlanAlignedPrefix}
                    {' '}(e.g. VLAN {vid} &rarr; {firstOctet}.{idx + 1}.{vid & 0xff}.0)
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Sequential fixed options */}
      {mode === 'sequential-fixed' && (
        <div className="space-y-3">
          <div className="max-w-xs">
            <label className="text-xs font-medium">Subnet Prefix</label>
            <select
              value={state.sequentialFixedPrefix}
              onChange={(e) => onChange({ sequentialFixedPrefix: parseInt(e.target.value, 10), addressPlan: [] })}
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm font-mono"
            >
              {[22, 23, 24, 25, 26, 27, 28].map((p) => (
                <option key={p} value={p}>/{p} ({Math.pow(2, 32 - p) - 2} hosts)</option>
              ))}
            </select>
          </div>

          {validationErrors.length === 0 && (
            <div className="text-xs text-muted-foreground">
              <span className="font-medium">Preview: </span>
              subnets packed sequentially from <span className="font-mono">{state.supernet}</span>
              {' '}as /{state.sequentialFixedPrefix} blocks
            </div>
          )}
        </div>
      )}

      {/* Validation errors (for non-VLSM modes) */}
      {mode !== 'vlsm' && validationErrors.length > 0 && (
        <div className="rounded-md border border-yellow-500/50 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-700 dark:text-yellow-400 space-y-1">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4" /> Validation
          </div>
          {validationErrors.map((e, i) => <div key={i}>{e}</div>)}
        </div>
      )}

      {/* Calculate button */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={calculate}
          disabled={loading || (mode !== 'vlsm' && validationErrors.length > 0)}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          {hasResults ? 'Recalculate' : 'Generate Subnets'}
        </button>
        {mode === 'vlsm' && state.vlsmResult && (
          <span className="text-xs text-muted-foreground">
            {state.vlsmResult.allocations.length} subnets allocated,{' '}
            {state.vlsmResult.remaining.length} blocks remaining
          </span>
        )}
        {mode !== 'vlsm' && hasResults && (
          <span className="text-xs text-muted-foreground">
            {state.addressPlan.length} subnets generated
          </span>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {hasResults && (
        <div className="rounded-lg border border-border overflow-hidden overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-3 py-2 text-left font-medium">Site</th>
                <th className="px-3 py-2 text-left font-medium">VLAN</th>
                <th className="px-3 py-2 text-left font-medium">Subnet</th>
                <th className="px-3 py-2 text-left font-medium">Gateway</th>
                <th className="px-3 py-2 text-left font-medium">Host Min</th>
                <th className="px-3 py-2 text-left font-medium">Host Max</th>
                <th className="px-3 py-2 text-left font-medium">Broadcast</th>
                <th className="px-3 py-2 text-right font-medium">Hosts</th>
              </tr>
            </thead>
            <tbody>
              {state.addressPlan.map((entry, idx) => {
                const siteName = getSiteName(entry.siteTempId)
                const tpl = state.vlanTemplates.find((t) => t.tempId === entry.vlanTempId)
                const details = computeSubnetDetails(entry.subnet)
                const allocKey = `${siteName} - ${tpl?.name ?? ''}`
                const alloc = allocByName.get(allocKey)
                const availableHosts = Math.pow(2, 32 - parseInt(entry.subnet.split('/')[1], 10)) - 2
                return (
                  <tr key={idx} className="border-b border-border">
                    <td className="px-3 py-2">{siteName}</td>
                    <td className="px-3 py-2">{getVlanLabel(entry.vlanTempId, entry.siteTempId)}</td>
                    <td className="px-3 py-2 font-mono text-xs">{entry.subnet}</td>
                    <td className="px-3 py-2 font-mono text-xs">{details.gateway}</td>
                    <td className="px-3 py-2 font-mono text-xs">{details.hostMin}</td>
                    <td className="px-3 py-2 font-mono text-xs">{details.hostMax}</td>
                    <td className="px-3 py-2 font-mono text-xs">{details.broadcast}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground">
                      {alloc
                        ? `${alloc.hosts_requested}/${alloc.hosts_available}`
                        : availableHosts}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Route Summarization */}
      {hasResults && summaryRoutes.length > 0 && (
        <div className="rounded-md border border-border p-4 space-y-2">
          <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Route Summarization
          </h3>
          <div className="space-y-1">
            {summaryRoutes.map((sr) => {
              const siteName = getSiteName(sr.siteTempId)
              if (sr.subnetCount === 0) return null
              return (
                <div key={sr.siteTempId} className="flex items-center gap-2 text-sm">
                  {sr.canSummarize ? (
                    <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />
                  )}
                  <span className="font-medium">{siteName}:</span>
                  <span className="font-mono text-xs">{sr.summaryRoute}</span>
                  <span className="text-xs text-muted-foreground">
                    ({sr.subnetCount} subnets{!sr.canSummarize && ' — includes unused space'})
                  </span>
                </div>
              )
            })}
          </div>
        </div>
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
          disabled={!hasResults}
          onClick={onNext}
          className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  )
}
