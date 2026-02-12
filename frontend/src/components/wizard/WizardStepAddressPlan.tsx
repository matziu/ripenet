import { useState } from 'react'
import { RefreshCw, AlertTriangle } from 'lucide-react'
import { toolsApi } from '@/api/endpoints'
import type { WizardState, VLSMResult, VLSMAllocation } from '@/lib/wizard.types'
import {
  buildVlsmRequirements,
  buildAddressPlan,
  buildVlanAlignedPlan,
  validateVlanAligned,
  computeSubnetDetails,
} from '@/lib/wizard.utils'

interface Props {
  state: WizardState
  onChange: (patch: Partial<WizardState>) => void
  onNext: () => void
  onBack: () => void
}

export function WizardStepAddressPlan({ state, onChange, onNext, onBack }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isVlsm = state.addressingMode === 'vlsm'
  const alignedErrors = !isVlsm ? validateVlanAligned(state) : []

  const calculate = async () => {
    if (isVlsm) {
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
      // VLAN-aligned: compute locally
      setError(null)
      if (alignedErrors.length > 0) {
        setError(alignedErrors.join('. '))
        return
      }
      const addressPlan = buildVlanAlignedPlan(state)
      onChange({ vlsmResult: undefined, addressPlan })
    }
  }

  const setMode = (mode: WizardState['addressingMode']) => {
    onChange({ addressingMode: mode, addressPlan: [], vlsmResult: undefined })
    setError(null)
  }

  const getSiteName = (tempId: string) =>
    state.sites.find((s) => s.tempId === tempId)?.name ?? tempId
  const getVlanName = (tempId: string) => {
    const tpl = state.vlanTemplates.find((t) => t.tempId === tempId)
    return tpl ? `VLAN ${tpl.vlanId} - ${tpl.name}` : tempId
  }

  // Build lookup for VLSM host counts
  const allocByName = new Map<string, VLSMAllocation>()
  if (state.vlsmResult) {
    for (const a of state.vlsmResult.allocations) {
      allocByName.set(a.name, a)
    }
  }

  const hasResults = state.addressPlan.length > 0

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">Address Plan</h2>
        <p className="text-sm text-muted-foreground">
          Choose an addressing strategy and generate subnet allocations from your
          supernet <span className="font-mono">{state.supernet}</span>.
        </p>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => setMode('vlsm')}
          className={`flex-1 rounded-md border px-4 py-3 text-left transition-colors ${
            isVlsm
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border hover:bg-accent'
          }`}
        >
          <div className="text-sm font-medium">VLSM</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Optimal sizing based on host count
          </div>
        </button>
        <button
          type="button"
          onClick={() => setMode('vlan-aligned')}
          className={`flex-1 rounded-md border px-4 py-3 text-left transition-colors ${
            !isVlsm
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border hover:bg-accent'
          }`}
        >
          <div className="text-sm font-medium">VLAN-Aligned</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            VLAN ID = 3rd octet (e.g. VLAN 100 → x.x.100.0)
          </div>
        </button>
      </div>

      {/* VLAN-aligned options */}
      {!isVlsm && (
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

          {/* Show site block assignments */}
          {alignedErrors.length === 0 && (
            <div className="text-xs text-muted-foreground space-y-0.5">
              <span className="font-medium">Site blocks:</span>
              {state.sites.map((site, idx) => {
                const [ipStr] = state.supernet.split('/')
                const parts = ipStr.split('.').map(Number)
                const baseNum = ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0
                const base16 = baseNum & 0xffff0000
                const siteNum = (base16 + (idx << 16)) >>> 0
                const o1 = (siteNum >>> 24) & 0xff
                const o2 = (siteNum >>> 16) & 0xff
                return (
                  <div key={site.tempId} className="font-mono">
                    {site.name}: {o1}.{o2}.&#123;VLAN ID&#125;.0/{state.vlanAlignedPrefix}
                  </div>
                )
              })}
            </div>
          )}

          {alignedErrors.length > 0 && (
            <div className="rounded-md border border-yellow-500/50 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-700 dark:text-yellow-400 space-y-1">
              <div className="flex items-center gap-2 font-medium">
                <AlertTriangle className="h-4 w-4" /> Validation
              </div>
              {alignedErrors.map((e, i) => <div key={i}>{e}</div>)}
            </div>
          )}
        </div>
      )}

      {/* Calculate button */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={calculate}
          disabled={loading || (!isVlsm && alignedErrors.length > 0)}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          {hasResults ? 'Recalculate' : 'Generate Subnets'}
        </button>
        {isVlsm && state.vlsmResult && (
          <span className="text-xs text-muted-foreground">
            {state.vlsmResult.allocations.length} subnets allocated,{' '}
            {state.vlsmResult.remaining.length} blocks remaining
          </span>
        )}
        {!isVlsm && hasResults && (
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
                // For VLSM mode, show requested/available from API result
                const allocKey = `${siteName} - ${tpl?.name ?? ''}`
                const alloc = allocByName.get(allocKey)
                // For vlan-aligned, compute available hosts from prefix
                const availableHosts = Math.pow(2, 32 - parseInt(entry.subnet.split('/')[1], 10)) - 2
                return (
                  <tr key={idx} className="border-b border-border">
                    <td className="px-3 py-2">{siteName}</td>
                    <td className="px-3 py-2">{getVlanName(entry.vlanTempId)}</td>
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
