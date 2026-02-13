import { useState, useMemo } from 'react'
import { RefreshCw, AlertTriangle } from 'lucide-react'
import { toolsApi } from '@/api/endpoints'
import type { WizardState, VLSMResult, VLSMAllocation } from '@/lib/wizard.types'
import {
  buildVlsmRequirements,
  buildVlsmRequirementsBySupernet,
  buildAddressPlan,
  buildVlanAlignedPlan,
  validateVlanAligned,
  buildSequentialFixedPlan,
  validateSequentialFixed,
  buildSiteInOctetPlan,
  validateSiteInOctet,
  computeSubnetDetails,
  computeGateway,
  getVlanIdForSite,
  getEffectiveVlansForSite,
  getSiteSupernet,
  hasMixedSupernets,
  getSiteAddressingMode,
  buildPerSiteAddressPlan,
  buildManualPlanEntries,
  validatePerSiteAddressing,
  validateOverlaps,
  isValidCidr,
} from '@/lib/wizard.utils'

interface Props {
  state: WizardState
  onChange: (patch: Partial<WizardState>) => void
  onNext: () => void
  onBack: () => void
}

type AddressingMode = WizardState['addressingMode']

const MODE_LABELS: Record<AddressingMode, string> = {
  vlsm: 'VLSM',
  'vlan-aligned': 'VLAN-Aligned',
  'site-in-octet': 'Site-in-Octet',
  'sequential-fixed': 'Sequential Fixed',
  manual: 'Manual',
}

const MODE_INFO: { mode: AddressingMode; label: string; desc: string }[] = [
  { mode: 'vlsm', label: 'VLSM', desc: 'Optimal sizing based on host count' },
  { mode: 'vlan-aligned', label: 'VLAN-Aligned', desc: 'VLAN ID = 3rd octet (e.g. VLAN 100 → x.x.100.0)' },
  { mode: 'site-in-octet', label: 'Site-in-Octet', desc: '2nd octet = site index (requires /8 supernet)' },
  { mode: 'sequential-fixed', label: 'Sequential Fixed', desc: 'Equal-size subnets packed sequentially' },
  { mode: 'manual', label: 'Manual', desc: 'Enter subnet addresses manually for each VLAN' },
]

export function WizardStepAddressPlan({ state, onChange, onNext, onBack }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mode = state.addressingMode
  const mixed = hasMixedSupernets(state)
  const perSiteEnabled = Object.keys(state.perSiteAddressingMode).length > 0

  // --- Validation ---
  const validationMessages = (() => {
    if (perSiteEnabled) return validatePerSiteAddressing(state)
    switch (mode) {
      case 'vlan-aligned': return validateVlanAligned(state)
      case 'site-in-octet': return validateSiteInOctet(state)
      case 'sequential-fixed': return validateSequentialFixed(state)
      default: return []
    }
  })()
  const validationErrors = validationMessages.filter((m) => !m.includes('will use the enclosing'))
  const validationWarnings = validationMessages.filter((m) => m.includes('will use the enclosing'))

  // --- Does any site use VLSM? ---
  const hasVlsmSites = perSiteEnabled
    ? state.sites.some((s) => getSiteAddressingMode(state, s.tempId) === 'vlsm')
    : mode === 'vlsm'
  // --- Calculate ---
  const calculate = async () => {
    setError(null)

    if (perSiteEnabled) {
      // Per-site mode: build auto entries + manual scaffolding + VLSM via API
      const autoPlan = buildPerSiteAddressPlan(state)
      const manualEntries = buildManualPlanEntries(state)
      // Preserve existing manual entries if they match
      const existingManual = state.addressPlan.filter((e) => e.subnet && manualEntries.some(
        (m) => m.siteTempId === e.siteTempId && m.vlanTempId === e.vlanTempId,
      ))
      const mergedManual = manualEntries.map((m) => {
        const existing = existingManual.find((e) => e.siteTempId === m.siteTempId && e.vlanTempId === m.vlanTempId)
        return existing ?? m
      })

      if (validationErrors.length > 0) {
        setError(validationErrors.join('. '))
        return
      }

      if (hasVlsmSites) {
        setLoading(true)
        try {
          const vlsmSupernets = new Map<string, { name: string; hosts: number }[]>()
          for (let siteIdx = 0; siteIdx < state.sites.length; siteIdx++) {
            const site = state.sites[siteIdx]
            if (getSiteAddressingMode(state, site.tempId) !== 'vlsm') continue
            const sn = getSiteSupernet(state, site.tempId)
            const vlans = getEffectiveVlansForSite(state, site.tempId, siteIdx)
            const reqs = vlsmSupernets.get(sn) ?? []
            for (const vlan of vlans) {
              reqs.push({ name: `${site.name} - ${vlan.name}`, hosts: vlan.hostsNeeded })
            }
            vlsmSupernets.set(sn, reqs)
          }

          const allAllocations: VLSMAllocation[] = []
          const allRemaining: string[] = []
          let mergedParent = state.supernet

          for (const [supernet, reqs] of vlsmSupernets) {
            const res = await toolsApi.vlsm(supernet, reqs)
            const result = res.data as VLSMResult
            allAllocations.push(...result.allocations)
            allRemaining.push(...result.remaining)
            mergedParent = supernet
          }

          const vlsmResult: VLSMResult = { parent: mergedParent, allocations: allAllocations, remaining: allRemaining }
          const vlsmPlan = buildAddressPlan(state, vlsmResult)
          onChange({ vlsmResult, addressPlan: [...vlsmPlan, ...autoPlan, ...mergedManual] })
        } catch (err: unknown) {
          const msg = err && typeof err === 'object' && 'response' in err
            ? String((err as { response: { data: { detail?: string } } }).response?.data?.detail ?? 'VLSM calculation failed')
            : 'VLSM calculation failed'
          setError(msg)
        } finally {
          setLoading(false)
        }
      } else {
        onChange({ vlsmResult: undefined, addressPlan: [...autoPlan, ...mergedManual] })
      }
      return
    }

    // Global mode (no per-site overrides)
    if (mode === 'manual') {
      // Scaffold empty entries, preserving existing ones
      const manualEntries = buildManualPlanEntries(state)
      const merged = manualEntries.map((m) => {
        const existing = state.addressPlan.find(
          (e) => e.siteTempId === m.siteTempId && e.vlanTempId === m.vlanTempId && e.subnet,
        )
        return existing ?? m
      })
      onChange({ vlsmResult: undefined, addressPlan: merged })
      return
    }

    if (mode === 'vlsm') {
      setLoading(true)
      try {
        if (mixed) {
          const groups = buildVlsmRequirementsBySupernet(state)
          const allAllocations: VLSMAllocation[] = []
          const allRemaining: string[] = []
          let mergedParent = state.supernet

          for (const [supernet, reqs] of groups) {
            const res = await toolsApi.vlsm(supernet, reqs)
            const result = res.data as VLSMResult
            allAllocations.push(...result.allocations)
            allRemaining.push(...result.remaining)
            mergedParent = supernet
          }

          const vlsmResult: VLSMResult = { parent: mergedParent, allocations: allAllocations, remaining: allRemaining }
          const addressPlan = buildAddressPlan(state, vlsmResult)
          onChange({ vlsmResult, addressPlan })
        } else {
          const requirements = buildVlsmRequirements(state)
          const res = await toolsApi.vlsm(state.supernet, requirements)
          const vlsmResult = res.data as VLSMResult
          const addressPlan = buildAddressPlan(state, vlsmResult)
          onChange({ vlsmResult, addressPlan })
        }
      } catch (err: unknown) {
        const msg = err && typeof err === 'object' && 'response' in err
          ? String((err as { response: { data: { detail?: string } } }).response?.data?.detail ?? 'VLSM calculation failed')
          : 'VLSM calculation failed'
        setError(msg)
      } finally {
        setLoading(false)
      }
    } else {
      if (validationErrors.length > 0) {
        setError(validationErrors.join('. '))
        return
      }
      let addressPlan
      switch (mode) {
        case 'vlan-aligned': addressPlan = buildVlanAlignedPlan(state); break
        case 'site-in-octet': addressPlan = buildSiteInOctetPlan(state); break
        case 'sequential-fixed': addressPlan = buildSequentialFixedPlan(state); break
      }
      onChange({ vlsmResult: undefined, addressPlan })
    }
  }

  const setMode = (m: AddressingMode) => {
    onChange({ addressingMode: m, perSiteAddressingMode: {}, addressPlan: [], vlsmResult: undefined })
    setError(null)
  }

  const enablePerSite = () => {
    // Initialize per-site modes from current global mode
    const perSite: Record<string, AddressingMode> = {}
    for (const site of state.sites) {
      perSite[site.tempId] = mode
    }
    onChange({ perSiteAddressingMode: perSite, addressPlan: [], vlsmResult: undefined })
    setError(null)
  }

  const disablePerSite = () => {
    onChange({ perSiteAddressingMode: {}, addressPlan: [], vlsmResult: undefined })
    setError(null)
  }

  const setSiteMode = (siteTempId: string, m: AddressingMode) => {
    onChange({
      perSiteAddressingMode: { ...state.perSiteAddressingMode, [siteTempId]: m },
      addressPlan: [],
      vlsmResult: undefined,
    })
    setError(null)
  }

  const getSiteName = (tempId: string) =>
    state.sites.find((s) => s.tempId === tempId)?.name ?? tempId
  const getSiteIndex = (tempId: string) =>
    state.sites.findIndex((s) => s.tempId === tempId)
  const getVlanLabel = (vlanTempId: string, siteTempId: string) => {
    if (state.vlanMode === 'manual') {
      const mv = state.perSiteVlans[siteTempId]?.find((v) => v.tempId === vlanTempId)
      if (mv) return `VLAN ${mv.vlanId} - ${mv.name}`
      return vlanTempId
    }
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

  // --- Manual entry editing ---
  const isManualEntry = (entry: { siteTempId: string }) => {
    if (perSiteEnabled) return getSiteAddressingMode(state, entry.siteTempId) === 'manual'
    return mode === 'manual'
  }

  const updateManualEntry = (idx: number, subnet: string) => {
    const plan = [...state.addressPlan]
    const gw = isValidCidr(subnet) ? computeGateway(subnet) : ''
    plan[idx] = { ...plan[idx], subnet, gateway: gw }
    onChange({ addressPlan: plan })
  }

  const hasResults = state.addressPlan.length > 0

  // Overlap detection
  const overlapErrors = hasResults ? validateOverlaps(state.addressPlan) : []

  // Manual entries count
  const hasManualSites = perSiteEnabled
    ? state.sites.some((s) => getSiteAddressingMode(state, s.tempId) === 'manual')
    : mode === 'manual'
  const allManualFilled = hasManualSites
    ? state.addressPlan.filter((e) => isManualEntry(e)).every((e) => e.subnet && isValidCidr(e.subnet))
    : true

  const canGenerate = perSiteEnabled
    ? validationErrors.length === 0
    : mode === 'vlsm' || mode === 'manual' || validationErrors.length === 0

  const canProceed = hasResults && overlapErrors.length === 0 && allManualFilled

  // Group entries by site for per-site card layout
  const siteGroups = useMemo(() => {
    if (!hasResults) return []
    const groups: { siteTempId: string; name: string; supernet: string; mode: AddressingMode; entries: { entry: typeof state.addressPlan[0]; globalIdx: number }[] }[] = []
    const seen = new Map<string, number>()
    state.addressPlan.forEach((entry, idx) => {
      let groupIdx = seen.get(entry.siteTempId)
      if (groupIdx === undefined) {
        groupIdx = groups.length
        seen.set(entry.siteTempId, groupIdx)
        groups.push({
          siteTempId: entry.siteTempId,
          name: getSiteName(entry.siteTempId),
          supernet: getSiteSupernet(state, entry.siteTempId),
          mode: perSiteEnabled ? getSiteAddressingMode(state, entry.siteTempId) : mode,
          entries: [],
        })
      }
      groups[groupIdx].entries.push({ entry, globalIdx: idx })
    })
    return groups
  }, [state.addressPlan, state.sites, perSiteEnabled, state.perSiteAddressingMode, mode])

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">Address Plan</h2>
        <p className="text-sm text-muted-foreground">
          Choose an addressing strategy and generate subnet allocations
          {!perSiteEnabled && <> from your supernet <span className="font-mono">{state.supernet}</span></>}.
        </p>
      </div>

      {/* Per-site supernet info */}
      {mixed && !perSiteEnabled && (
        <div className="rounded-md border border-blue-500/30 bg-blue-500/5 px-4 py-3 text-sm space-y-1">
          <span className="font-medium">Per-site supernets active:</span>
          {state.sites.map((site) => {
            const sn = getSiteSupernet(state, site.tempId)
            const isOverride = site.supernet?.trim() && site.supernet.trim() !== state.supernet
            return (
              <div key={site.tempId} className="text-muted-foreground">
                {site.name}: <span className="font-mono text-xs">{sn}</span>
                {isOverride && <span className="text-blue-500 ml-1">(override)</span>}
              </div>
            )
          })}
        </div>
      )}

      {/* Per-site toggle */}
      {state.sites.length > 1 && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={perSiteEnabled ? disablePerSite : enablePerSite}
            className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
              perSiteEnabled
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border hover:bg-accent'
            }`}
          >
            {perSiteEnabled ? 'Per-site mode active' : 'Enable per-site addressing'}
          </button>
          {!perSiteEnabled && (
            <span className="text-xs text-muted-foreground">
              Choose different addressing modes for different sites
            </span>
          )}
        </div>
      )}

      {/* ===== GLOBAL MODE ===== */}
      {!perSiteEnabled && (
        <>
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

          {/* Mode-specific options */}
          {mode === 'vlan-aligned' && <PrefixSelector label="Subnet Prefix" value={state.vlanAlignedPrefix} options={[24,25,26,27,28]} onChange={(v) => onChange({ vlanAlignedPrefix: v, addressPlan: [] })} />}
          {mode === 'site-in-octet' && <PrefixSelector label="Subnet Prefix" value={state.vlanAlignedPrefix} options={[24,25,26,27,28]} onChange={(v) => onChange({ vlanAlignedPrefix: v, addressPlan: [] })} />}
          {mode === 'sequential-fixed' && <PrefixSelector label="Subnet Prefix" value={state.sequentialFixedPrefix} options={[22,23,24,25,26,27,28]} onChange={(v) => onChange({ sequentialFixedPrefix: v, addressPlan: [] })} />}
        </>
      )}

      {/* ===== PER-SITE MODE ===== */}
      {perSiteEnabled && (
        <div className="rounded-md border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-3 py-2 text-left font-medium">Site</th>
                <th className="px-3 py-2 text-left font-medium">Supernet</th>
                <th className="px-3 py-2 text-left font-medium">VLANs</th>
                <th className="px-3 py-2 text-left font-medium">Addressing Mode</th>
              </tr>
            </thead>
            <tbody>
              {state.sites.map((site, siteIdx) => {
                const sn = getSiteSupernet(state, site.tempId)
                const vlans = getEffectiveVlansForSite(state, site.tempId, siteIdx)
                const siteMode = getSiteAddressingMode(state, site.tempId)
                return (
                  <tr key={site.tempId} className="border-b border-border">
                    <td className="px-3 py-2 font-medium">{site.name || '(unnamed)'}</td>
                    <td className="px-3 py-2 font-mono text-xs">{sn}</td>
                    <td className="px-3 py-2 text-muted-foreground">{vlans.length}</td>
                    <td className="px-3 py-2">
                      {vlans.length === 0 ? (
                        <span className="text-muted-foreground text-xs">No VLANs</span>
                      ) : (
                        <select
                          value={siteMode}
                          onChange={(e) => setSiteMode(site.tempId, e.target.value as AddressingMode)}
                          className="rounded-md border border-input bg-background px-2 py-1 text-sm"
                        >
                          {MODE_INFO.map(({ mode: m, label }) => (
                            <option key={m} value={m}>{label}</option>
                          ))}
                        </select>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* Prefix settings for modes that need them */}
          <div className="border-t border-border bg-muted/30 px-3 py-3 flex flex-wrap gap-4">
            {state.sites.some((s) => {
              const m = getSiteAddressingMode(state, s.tempId)
              return m === 'vlan-aligned' || m === 'site-in-octet'
            }) && (
              <PrefixSelector
                label="VLAN-Aligned / Site-in-Octet prefix"
                value={state.vlanAlignedPrefix}
                options={[24,25,26,27,28]}
                onChange={(v) => onChange({ vlanAlignedPrefix: v, addressPlan: [] })}
              />
            )}
            {state.sites.some((s) => getSiteAddressingMode(state, s.tempId) === 'sequential-fixed') && (
              <PrefixSelector
                label="Sequential Fixed prefix"
                value={state.sequentialFixedPrefix}
                options={[22,23,24,25,26,27,28]}
                onChange={(v) => onChange({ sequentialFixedPrefix: v, addressPlan: [] })}
              />
            )}
          </div>
        </div>
      )}

      {/* Validation errors */}
      {validationErrors.length > 0 && (
        <div className="rounded-md border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-400 space-y-1">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4" /> Errors
          </div>
          {validationErrors.map((e, i) => <div key={i}>{e}</div>)}
        </div>
      )}

      {/* Validation warnings */}
      {validationWarnings.length > 0 && (
        <div className="rounded-md border border-yellow-500/50 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-700 dark:text-yellow-400 space-y-1">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4" /> Warnings
          </div>
          {validationWarnings.map((w, i) => <div key={i}>{w}</div>)}
        </div>
      )}

      {/* Calculate button */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={calculate}
          disabled={loading || !canGenerate}
          className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          {hasResults ? 'Recalculate' : 'Generate Subnets'}
        </button>
        {hasVlsmSites && state.vlsmResult && (
          <span className="text-xs text-muted-foreground">
            {state.vlsmResult.allocations.length} VLSM subnets allocated
          </span>
        )}
        {hasResults && (
          <span className="text-xs text-muted-foreground">
            {state.addressPlan.length} subnets total
          </span>
        )}
      </div>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Results — per-site cards when perSiteEnabled, single table otherwise */}
      {hasResults && perSiteEnabled && (
        <div className="space-y-4">
          {siteGroups.map((group) => (
            <div key={group.siteTempId} className="rounded-lg border border-border overflow-hidden">
              {/* Card header */}
              <div className="flex items-center gap-3 bg-muted/50 px-4 py-2.5 border-b border-border">
                <span className="font-medium text-sm">{group.name}</span>
                <span className="rounded-full bg-primary/10 text-primary px-2.5 py-0.5 text-xs font-medium">
                  {MODE_LABELS[group.mode]}
                </span>
                <span className="font-mono text-xs text-muted-foreground">{group.supernet}</span>
                <span className="ml-auto text-xs text-muted-foreground">{group.entries.length} subnets</span>
              </div>
              {/* Site table */}
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="px-3 py-1.5 text-left text-xs font-medium text-muted-foreground">VLAN</th>
                    <th className="px-3 py-1.5 text-left text-xs font-medium text-muted-foreground">Subnet</th>
                    <th className="px-3 py-1.5 text-left text-xs font-medium text-muted-foreground">Gateway</th>
                    <th className="px-3 py-1.5 text-left text-xs font-medium text-muted-foreground">Host Range</th>
                    <th className="px-3 py-1.5 text-right text-xs font-medium text-muted-foreground">Hosts</th>
                  </tr>
                </thead>
                <tbody>
                  {group.entries.map(({ entry, globalIdx }) => {
                    const isEditable = isManualEntry(entry)
                    const hasSubnet = entry.subnet && isValidCidr(entry.subnet)
                    const details = hasSubnet ? computeSubnetDetails(entry.subnet) : null
                    const siteName = group.name
                    const tpl = state.vlanMode === 'manual'
                      ? state.perSiteVlans[entry.siteTempId]?.find((v) => v.tempId === entry.vlanTempId)
                      : state.vlanTemplates.find((t) => t.tempId === entry.vlanTempId)
                    const allocKey = `${siteName} - ${tpl?.name ?? ''}`
                    const alloc = allocByName.get(allocKey)
                    const availableHosts = hasSubnet
                      ? Math.pow(2, 32 - parseInt(entry.subnet.split('/')[1], 10)) - 2
                      : 0
                    const invalidFormat = entry.subnet && !isValidCidr(entry.subnet)
                    return (
                      <tr key={globalIdx} className={`border-b border-border last:border-b-0 ${isEditable ? 'bg-muted/10' : ''}`}>
                        <td className="px-3 py-1.5 text-sm">{getVlanLabel(entry.vlanTempId, entry.siteTempId)}</td>
                        <td className="px-3 py-1.5 font-mono text-xs">
                          {isEditable ? (
                            <input
                              value={entry.subnet}
                              onChange={(e) => updateManualEntry(globalIdx, e.target.value)}
                              placeholder="e.g. 192.168.1.0/24"
                              className={`w-40 rounded-md border bg-background px-2 py-1 text-xs font-mono ${
                                invalidFormat ? 'border-red-400' : !entry.subnet ? 'border-yellow-400' : 'border-input'
                              }`}
                            />
                          ) : (
                            entry.subnet
                          )}
                        </td>
                        <td className="px-3 py-1.5 font-mono text-xs">{details?.gateway ?? ''}</td>
                        <td className="px-3 py-1.5 font-mono text-xs">
                          {details ? `${details.hostMin} – ${details.hostMax}` : ''}
                        </td>
                        <td className="px-3 py-1.5 text-right text-muted-foreground">
                          {alloc ? `${alloc.hosts_requested}/${alloc.hosts_available}` : (hasSubnet ? availableHosts : '')}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {/* Results — single table for global mode */}
      {hasResults && !perSiteEnabled && (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-3 py-2 text-left font-medium">Site</th>
                <th className="px-3 py-2 text-left font-medium">VLAN</th>
                <th className="px-3 py-2 text-left font-medium">Subnet</th>
                <th className="px-3 py-2 text-left font-medium">Gateway</th>
                <th className="px-3 py-2 text-left font-medium">Host Range</th>
                <th className="px-3 py-2 text-right font-medium">Hosts</th>
              </tr>
            </thead>
            <tbody>
              {state.addressPlan.map((entry, idx) => {
                const siteName = getSiteName(entry.siteTempId)
                const tpl = state.vlanMode === 'manual'
                  ? state.perSiteVlans[entry.siteTempId]?.find((v) => v.tempId === entry.vlanTempId)
                  : state.vlanTemplates.find((t) => t.tempId === entry.vlanTempId)
                const isEditable = isManualEntry(entry)
                const hasSubnet = entry.subnet && isValidCidr(entry.subnet)
                const details = hasSubnet ? computeSubnetDetails(entry.subnet) : null
                const allocKey = `${siteName} - ${tpl?.name ?? ''}`
                const alloc = allocByName.get(allocKey)
                const availableHosts = hasSubnet
                  ? Math.pow(2, 32 - parseInt(entry.subnet.split('/')[1], 10)) - 2
                  : 0
                const invalidFormat = entry.subnet && !isValidCidr(entry.subnet)
                return (
                  <tr key={idx} className={`border-b border-border ${isEditable ? 'bg-muted/20' : ''}`}>
                    <td className="px-3 py-2">{siteName}</td>
                    <td className="px-3 py-2">{getVlanLabel(entry.vlanTempId, entry.siteTempId)}</td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {isEditable ? (
                        <input
                          value={entry.subnet}
                          onChange={(e) => updateManualEntry(idx, e.target.value)}
                          placeholder="e.g. 192.168.1.0/24"
                          className={`w-40 rounded-md border bg-background px-2 py-1 text-xs font-mono ${
                            invalidFormat ? 'border-red-400' : !entry.subnet ? 'border-yellow-400' : 'border-input'
                          }`}
                        />
                      ) : (
                        entry.subnet
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{details?.gateway ?? ''}</td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {details ? `${details.hostMin} – ${details.hostMax}` : ''}
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground">
                      {alloc ? `${alloc.hosts_requested}/${alloc.hosts_available}` : (hasSubnet ? availableHosts : '')}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Overlap errors */}
      {overlapErrors.length > 0 && (
        <div className="rounded-md border border-red-500/50 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-400 space-y-1">
          <div className="flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4" /> Subnet Overlaps
          </div>
          {overlapErrors.map((e, i) => <div key={i}>{e}</div>)}
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
          disabled={!canProceed}
          onClick={onNext}
          className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  )
}

function PrefixSelector({ label, value, options, onChange }: {
  label: string
  value: number
  options: number[]
  onChange: (v: number) => void
}) {
  return (
    <div className="max-w-xs">
      <label className="text-xs font-medium">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(parseInt(e.target.value, 10))}
        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm font-mono"
      >
        {options.map((p) => (
          <option key={p} value={p}>/{p} ({Math.pow(2, 32 - p) - 2} hosts)</option>
        ))}
      </select>
    </div>
  )
}
