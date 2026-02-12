import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { toolsApi } from '@/api/endpoints'
import type { WizardState, VLSMResult, VLSMAllocation } from '@/lib/wizard.types'
import { buildVlsmRequirements, buildAddressPlan, computeSubnetDetails } from '@/lib/wizard.utils'

interface Props {
  state: WizardState
  onChange: (patch: Partial<WizardState>) => void
  onNext: () => void
  onBack: () => void
}

export function WizardStepAddressPlan({ state, onChange, onNext, onBack }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const calculate = async () => {
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
  }

  const getSiteName = (tempId: string) =>
    state.sites.find((s) => s.tempId === tempId)?.name ?? tempId
  const getVlanName = (tempId: string) => {
    const tpl = state.vlanTemplates.find((t) => t.tempId === tempId)
    return tpl ? `VLAN ${tpl.vlanId} - ${tpl.name}` : tempId
  }

  // Build lookup: "SiteName - VlanName" -> allocation
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
          Calculate optimal subnet sizes using VLSM. The algorithm allocates subnets from your
          supernet ({state.supernet}) based on host requirements.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={calculate}
          disabled={loading}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          {hasResults ? 'Recalculate' : 'Calculate Subnets'}
        </button>
        {state.vlsmResult && (
          <span className="text-xs text-muted-foreground">
            {state.vlsmResult.allocations.length} subnets allocated,{' '}
            {state.vlsmResult.remaining.length} blocks remaining
          </span>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {hasResults && (
        <div className="rounded-lg border border-border overflow-hidden">
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
                const allocKey = `${siteName} - ${tpl?.name ?? ''}`
                const alloc = allocByName.get(allocKey)
                const details = computeSubnetDetails(entry.subnet)
                return (
                  <tr key={idx} className="border-b border-border">
                    <td className="px-3 py-2">{siteName}</td>
                    <td className="px-3 py-2">{getVlanName(entry.vlanTempId)}</td>
                    <td className="px-3 py-2 font-mono text-xs">{entry.subnet}</td>
                    <td className="px-3 py-2 font-mono text-xs">{details.gateway}</td>
                    <td className="px-3 py-2 font-mono text-xs">{details.hostMin}</td>
                    <td className="px-3 py-2 font-mono text-xs">{details.hostMax}</td>
                    <td className="px-3 py-2 font-mono text-xs">{details.broadcast}</td>
                    <td className="px-3 py-2 text-right">
                      {alloc && (
                        <span className="text-muted-foreground">
                          {alloc.hosts_requested}/{alloc.hosts_available}
                        </span>
                      )}
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
