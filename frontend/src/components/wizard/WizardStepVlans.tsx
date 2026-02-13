import { useState } from 'react'
import { Plus, Trash2, Settings2, Save, X, Copy } from 'lucide-react'
import type { WizardState, WizardSiteOverride, WizardManualVlan } from '@/lib/wizard.types'
import {
  tempId,
  getVlanIdForSite,
  getEffectiveVlansForSite,
  getAllPresets,
  saveCurrentAsPreset,
  deleteCustomPreset,
} from '@/lib/wizard.utils'

interface Props {
  state: WizardState
  onChange: (patch: Partial<WizardState>) => void
  onNext: () => void
  onBack: () => void
}

export function WizardStepVlans({ state, onChange, onNext, onBack }: Props) {
  const [showOverrides, setShowOverrides] = useState(false)
  const [presets, setPresets] = useState(getAllPresets)
  const [savingPreset, setSavingPreset] = useState(false)
  const [presetName, setPresetName] = useState('')
  const [activeManualSite, setActiveManualSite] = useState(
    () => state.sites[0]?.tempId ?? '',
  )
  const [manualStartId, setManualStartId] = useState(10)
  const [manualStep, setManualStep] = useState(10)

  const isManual = state.vlanMode === 'manual'

  // --- Template mode helpers ---

  const loadPreset = (presetId: string) => {
    const preset = presets.find((p) => p.id === presetId)
    if (!preset) return
    if (isManual) {
      // In manual mode, load preset into the active site
      const vlans: WizardManualVlan[] = preset.templates.map((t) => ({
        ...t,
        tempId: tempId(),
      }))
      onChange({
        perSiteVlans: { ...state.perSiteVlans, [activeManualSite]: vlans },
        addressPlan: [],
      })
    } else {
      onChange({
        vlanTemplates: preset.templates.map((t) => ({
          ...t,
          tempId: tempId(),
        })),
        perSiteOverrides: {},
        addressPlan: [],
      })
    }
  }

  const handleSavePreset = () => {
    if (!presetName.trim() || state.vlanTemplates.length === 0) return
    saveCurrentAsPreset(presetName.trim(), state)
    setPresets(getAllPresets())
    setPresetName('')
    setSavingPreset(false)
  }

  const handleSaveManualPreset = () => {
    const vlans = getManualVlans(activeManualSite)
    if (!presetName.trim() || vlans.length === 0) return
    // Temporarily set vlanTemplates to manual VLANs so saveCurrentAsPreset picks them up
    const tempState = { ...state, vlanTemplates: vlans.map((v) => ({ ...v })) }
    saveCurrentAsPreset(presetName.trim(), tempState)
    setPresets(getAllPresets())
    setPresetName('')
    setSavingPreset(false)
  }

  const handleDeletePreset = (id: string) => {
    deleteCustomPreset(id)
    setPresets(getAllPresets())
  }

  const applyAutoNumber = (start: number, step: number) => {
    onChange({
      vlanStartId: start,
      vlanStep: step,
      vlanTemplates: state.vlanTemplates.map((t, i) => ({
        ...t,
        vlanId: start + i * step,
      })),
    })
  }

  const addTemplate = () => {
    const nextVlanId = state.vlanStartId + state.vlanTemplates.length * state.vlanStep
    onChange({
      vlanTemplates: [
        ...state.vlanTemplates,
        { tempId: tempId(), vlanId: nextVlanId, name: '', purpose: '', hostsNeeded: 10 },
      ],
    })
  }

  const removeTemplate = (id: string) => {
    onChange({
      vlanTemplates: state.vlanTemplates.filter((t) => t.tempId !== id),
    })
  }

  const updateTemplate = (id: string, field: string, value: string | number) => {
    onChange({
      vlanTemplates: state.vlanTemplates.map((t) =>
        t.tempId === id ? { ...t, [field]: value } : t,
      ),
    })
  }

  const updateOverride = (siteTempId: string, tplIndex: number, patch: Partial<WizardSiteOverride>) => {
    const current = { ...state.perSiteOverrides }
    if (!current[siteTempId]) {
      current[siteTempId] = state.vlanTemplates.map(() => ({}))
    }
    while (current[siteTempId].length < state.vlanTemplates.length) {
      current[siteTempId].push({})
    }
    current[siteTempId] = current[siteTempId].map((o, i) =>
      i === tplIndex ? { ...o, ...patch } : o,
    )
    onChange({ perSiteOverrides: current })
  }

  const getOverride = (siteTempId: string, tplIndex: number): WizardSiteOverride => {
    return state.perSiteOverrides[siteTempId]?.[tplIndex] ?? {}
  }

  // --- Manual mode helpers ---

  const getManualVlans = (siteTempId: string): WizardManualVlan[] =>
    state.perSiteVlans[siteTempId] ?? []

  const setManualVlans = (siteTempId: string, vlans: WizardManualVlan[]) => {
    onChange({
      perSiteVlans: { ...state.perSiteVlans, [siteTempId]: vlans },
      addressPlan: [],
    })
  }

  const addManualVlan = (siteTempId: string) => {
    const current = getManualVlans(siteTempId)
    const nextId = current.length > 0
      ? Math.max(...current.map((v) => v.vlanId)) + manualStep
      : manualStartId
    setManualVlans(siteTempId, [
      ...current,
      { tempId: tempId(), vlanId: nextId, name: '', purpose: '', hostsNeeded: 10 },
    ])
  }

  const renumberManualVlans = (siteTempId: string) => {
    const current = getManualVlans(siteTempId)
    setManualVlans(
      siteTempId,
      current.map((v, i) => ({ ...v, vlanId: manualStartId + i * manualStep })),
    )
  }

  const removeManualVlan = (siteTempId: string, vlanTempId: string) => {
    setManualVlans(
      siteTempId,
      getManualVlans(siteTempId).filter((v) => v.tempId !== vlanTempId),
    )
  }

  const updateManualVlan = (
    siteTempId: string,
    vlanTempId: string,
    field: keyof WizardManualVlan,
    value: string | number,
  ) => {
    setManualVlans(
      siteTempId,
      getManualVlans(siteTempId).map((v) =>
        v.tempId === vlanTempId ? { ...v, [field]: value } : v,
      ),
    )
  }

  const copyVlansFrom = (sourceSiteTempId: string) => {
    const source = getManualVlans(sourceSiteTempId)
    const copied = source.map((v) => ({ ...v, tempId: tempId() }))
    setManualVlans(activeManualSite, copied)
  }

  // --- Mode switching ---

  const switchToManual = () => {
    // Pre-populate perSiteVlans from current templates + overrides
    const perSiteVlans: Record<string, WizardManualVlan[]> = {}
    for (let siteIdx = 0; siteIdx < state.sites.length; siteIdx++) {
      const site = state.sites[siteIdx]
      const effective = getEffectiveVlansForSite(state, site.tempId, siteIdx)
      perSiteVlans[site.tempId] = effective.map((v) => ({
        tempId: tempId(),
        vlanId: v.vlanId,
        name: v.name,
        purpose: v.purpose,
        hostsNeeded: v.hostsNeeded,
      }))
    }
    onChange({ vlanMode: 'manual', perSiteVlans, addressPlan: [] })
    setActiveManualSite(state.sites[0]?.tempId ?? '')
  }

  const switchToTemplate = () => {
    // Keep vlanTemplates as-is (don't reverse-engineer from manual)
    onChange({ vlanMode: 'template', addressPlan: [] })
  }

  // --- Validation ---

  const templateValid =
    state.vlanTemplates.length >= 1 &&
    state.vlanTemplates.every((t) => t.name.trim() !== '' && t.hostsNeeded > 0)

  const manualValid =
    state.sites.length > 0 &&
    state.sites.some((site) => getManualVlans(site.tempId).length > 0) &&
    state.sites.every((site) => {
      const vlans = getManualVlans(site.tempId)
      // Sites with no VLANs are allowed (they just won't get subnets)
      if (vlans.length === 0) return true
      return vlans.every((v) => v.name.trim() !== '' && v.hostsNeeded > 0)
    })

  const valid = isManual ? manualValid : templateValid

  const isPerSite = state.vlanNumbering === 'per-site'

  // Ensure activeManualSite is valid
  if (isManual && !state.sites.find((s) => s.tempId === activeManualSite) && state.sites.length > 0) {
    setActiveManualSite(state.sites[0].tempId)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">VLANs</h2>
        <p className="text-sm text-muted-foreground">
          {isManual
            ? 'Define VLANs independently for each site.'
            : 'Define VLAN templates that will be replicated across all sites.'}
        </p>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={switchToTemplate}
          className={`flex-1 rounded-md border px-3 py-2 text-sm text-left transition-colors ${
            !isManual
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border hover:bg-accent'
          }`}
        >
          <div className="font-medium">Template (all sites)</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            One set of VLANs replicated to every site
          </div>
        </button>
        <button
          type="button"
          onClick={switchToManual}
          className={`flex-1 rounded-md border px-3 py-2 text-sm text-left transition-colors ${
            isManual
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border hover:bg-accent'
          }`}
        >
          <div className="font-medium">Manual (per site)</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Define VLANs independently for each site
          </div>
        </button>
      </div>

      {/* ============= TEMPLATE MODE ============= */}
      {!isManual && (
        <>
          {/* Presets */}
          <div className="rounded-md border border-border p-4 space-y-3">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Presets
            </h3>
            <div className="flex flex-wrap gap-2">
              {presets.map((preset) => (
                <div key={preset.id} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => loadPreset(preset.id)}
                    className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent hover:text-foreground transition-colors"
                  >
                    {preset.name}
                    <span className="text-xs text-muted-foreground ml-1">
                      ({preset.templates.length})
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeletePreset(preset.id)}
                    className="p-1 rounded hover:bg-destructive/10"
                    title="Delete preset"
                  >
                    <X className="h-3 w-3 text-muted-foreground" />
                  </button>
                </div>
              ))}
            </div>
            {!savingPreset ? (
              <button
                type="button"
                onClick={() => setSavingPreset(true)}
                disabled={state.vlanTemplates.length === 0}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" />
                Save current as preset
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSavePreset()}
                  placeholder="Preset name"
                  autoFocus
                  className="w-40 rounded-md border border-input bg-background px-2 py-1 text-sm"
                />
                <button
                  type="button"
                  onClick={handleSavePreset}
                  disabled={!presetName.trim()}
                  className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => { setSavingPreset(false); setPresetName('') }}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          {/* VLAN Numbering Config */}
          <div className="rounded-md border border-border p-4 space-y-3">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              VLAN Numbering
            </h3>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => onChange({ vlanNumbering: 'same' })}
                className={`flex-1 rounded-md border px-3 py-2 text-sm text-left transition-colors ${
                  !isPerSite
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:bg-accent'
                }`}
              >
                <div className="font-medium">Same per site</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  All sites share VLAN IDs (e.g. VLAN 10, 20, 30)
                </div>
              </button>
              <button
                type="button"
                onClick={() => onChange({ vlanNumbering: 'per-site' })}
                className={`flex-1 rounded-md border px-3 py-2 text-sm text-left transition-colors ${
                  isPerSite
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:bg-accent'
                }`}
              >
                <div className="font-medium">Unique per site</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Each site gets offset IDs (e.g. Site 1: 100, Site 2: 200)
                </div>
              </button>
            </div>

            <div className={`grid gap-3 ${isPerSite ? 'grid-cols-3' : 'grid-cols-2'}`}>
              <div>
                <label className="text-xs font-medium">Start ID</label>
                <input
                  type="number"
                  min={1}
                  value={state.vlanStartId}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10) || 1
                    applyAutoNumber(v, state.vlanStep)
                  }}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm font-mono"
                />
              </div>
              <div>
                <label className="text-xs font-medium">Step</label>
                <input
                  type="number"
                  min={1}
                  value={state.vlanStep}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10) || 1
                    applyAutoNumber(state.vlanStartId, v)
                  }}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm font-mono"
                />
              </div>
              {isPerSite && (
                <div>
                  <label className="text-xs font-medium">Site Offset</label>
                  <input
                    type="number"
                    min={1}
                    value={state.vlanSiteOffset}
                    onChange={(e) => onChange({ vlanSiteOffset: parseInt(e.target.value, 10) || 1 })}
                    className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm font-mono"
                  />
                </div>
              )}
            </div>

            {/* Preview per-site numbering */}
            {isPerSite && state.sites.length > 0 && state.vlanTemplates.length > 0 && (
              <div className="text-xs text-muted-foreground space-y-0.5 pt-1">
                <span className="font-medium">Preview:</span>
                {state.sites.map((site, siteIdx) => (
                  <div key={site.tempId} className="font-mono">
                    {site.name}:{' '}
                    {state.vlanTemplates.map((tpl, i) => (
                      <span key={tpl.tempId}>
                        {i > 0 && ', '}
                        VLAN {getVlanIdForSite(tpl.vlanId, siteIdx, state)}
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Templates list */}
          <div className="space-y-3">
            {state.vlanTemplates.map((tpl) => (
              <div key={tpl.tempId} className="rounded-md border border-border p-3 space-y-2">
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <label className="text-xs font-medium">Base VLAN ID</label>
                    <input
                      type="number"
                      value={tpl.vlanId}
                      onChange={(e) => updateTemplate(tpl.tempId, 'vlanId', parseInt(e.target.value, 10) || 0)}
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium">Name <span className="text-red-500">*</span></label>
                    <input
                      value={tpl.name}
                      onChange={(e) => updateTemplate(tpl.tempId, 'name', e.target.value)}
                      placeholder="e.g. Management"
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium">Purpose</label>
                    <input
                      value={tpl.purpose}
                      onChange={(e) => updateTemplate(tpl.tempId, 'purpose', e.target.value)}
                      placeholder="e.g. Network mgmt"
                      className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                    />
                  </div>
                  <div className="flex items-end gap-1">
                    <div className="flex-1">
                      <label className="text-xs font-medium">Hosts <span className="text-red-500">*</span></label>
                      <input
                        type="number"
                        min={1}
                        value={tpl.hostsNeeded}
                        onChange={(e) => updateTemplate(tpl.tempId, 'hostsNeeded', parseInt(e.target.value, 10) || 1)}
                        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeTemplate(tpl.tempId)}
                      className="p-1.5 rounded hover:bg-destructive/10 mb-0.5"
                      title="Remove"
                    >
                      <Trash2 className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addTemplate}
            className="flex items-center gap-2 rounded-md border border-dashed border-border px-4 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors w-full justify-center"
          >
            <Plus className="h-4 w-4" />
            Add VLAN Template
          </button>

          {state.sites.length > 0 && state.vlanTemplates.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowOverrides(!showOverrides)}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
              >
                <Settings2 className="h-4 w-4" />
                {showOverrides ? 'Hide' : 'Show'} per-site overrides
              </button>

              {showOverrides && (
                <div className="mt-3 rounded-lg border border-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        <th className="px-3 py-2 text-left font-medium">Site</th>
                        {state.vlanTemplates.map((tpl) => (
                          <th key={tpl.tempId} className="px-3 py-2 text-left font-medium">
                            {tpl.name ? `${tpl.name} (${tpl.vlanId})` : `VLAN ${tpl.vlanId}`}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {state.sites.map((site, siteIdx) => (
                        <tr key={site.tempId} className="border-b border-border">
                          <td className="px-3 py-2 font-medium">{site.name || '(unnamed)'}</td>
                          {state.vlanTemplates.map((tpl, tplIdx) => {
                            const ov = getOverride(site.tempId, tplIdx)
                            const vid = getVlanIdForSite(tpl.vlanId, siteIdx, state)
                            return (
                              <td key={tpl.tempId} className="px-3 py-2">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <label className="flex items-center gap-1 text-xs">
                                      <input
                                        type="checkbox"
                                        checked={!ov.skip}
                                        onChange={(e) =>
                                          updateOverride(site.tempId, tplIdx, { skip: !e.target.checked })
                                        }
                                        className="rounded"
                                      />
                                      <span className="font-mono">{vid}</span>
                                    </label>
                                    {!ov.skip && (
                                      <input
                                        type="number"
                                        min={1}
                                        value={ov.hostsNeeded ?? ''}
                                        onChange={(e) =>
                                          updateOverride(site.tempId, tplIdx, {
                                            hostsNeeded: e.target.value ? parseInt(e.target.value, 10) : undefined,
                                          })
                                        }
                                        placeholder={String(tpl.hostsNeeded)}
                                        className="w-16 rounded-md border border-input bg-background px-2 py-0.5 text-xs"
                                      />
                                    )}
                                  </div>
                                  {!ov.skip && (
                                    <input
                                      value={ov.name ?? ''}
                                      onChange={(e) =>
                                        updateOverride(site.tempId, tplIdx, {
                                          name: e.target.value || undefined,
                                        })
                                      }
                                      placeholder={tpl.name}
                                      className="w-full rounded-md border border-input bg-background px-2 py-0.5 text-xs"
                                    />
                                  )}
                                </div>
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ============= MANUAL MODE ============= */}
      {isManual && (
        <>
          {/* Presets — load into active site */}
          <div className="rounded-md border border-border p-4 space-y-3">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Presets
            </h3>
            <div className="flex flex-wrap gap-2">
              {presets.map((preset) => (
                <div key={preset.id} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => loadPreset(preset.id)}
                    className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent hover:text-foreground transition-colors"
                  >
                    {preset.name}
                    <span className="text-xs text-muted-foreground ml-1">
                      ({preset.templates.length})
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeletePreset(preset.id)}
                    className="p-1 rounded hover:bg-destructive/10"
                    title="Delete preset"
                  >
                    <X className="h-3 w-3 text-muted-foreground" />
                  </button>
                </div>
              ))}
            </div>
            {!savingPreset ? (
              <button
                type="button"
                onClick={() => setSavingPreset(true)}
                disabled={getManualVlans(activeManualSite).length === 0}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" />
                Save current as preset
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveManualPreset()}
                  placeholder="Preset name"
                  autoFocus
                  className="w-40 rounded-md border border-input bg-background px-2 py-1 text-sm"
                />
                <button
                  type="button"
                  onClick={handleSaveManualPreset}
                  disabled={!presetName.trim()}
                  className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => { setSavingPreset(false); setPresetName('') }}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          {/* VLAN Numbering */}
          <div className="rounded-md border border-border p-4 space-y-3">
            <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              VLAN Numbering
            </h3>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium">Start ID</label>
                <input
                  type="number"
                  min={1}
                  value={manualStartId}
                  onChange={(e) => setManualStartId(parseInt(e.target.value, 10) || 1)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm font-mono"
                />
              </div>
              <div>
                <label className="text-xs font-medium">Step</label>
                <input
                  type="number"
                  min={1}
                  value={manualStep}
                  onChange={(e) => setManualStep(parseInt(e.target.value, 10) || 1)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm font-mono"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={() => renumberManualVlans(activeManualSite)}
                  disabled={getManualVlans(activeManualSite).length === 0}
                  className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-accent transition-colors disabled:opacity-50"
                >
                  Renumber
                </button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              New VLANs will use these settings. Click "Renumber" to re-apply to the active site.
            </p>
          </div>

          {/* Site tabs */}
          <div className="flex flex-wrap gap-1.5">
            {state.sites.map((site) => {
              const siteVlans = getManualVlans(site.tempId)
              const isActive = site.tempId === activeManualSite
              const invalidCount = siteVlans.filter((v) => !v.name.trim() || v.hostsNeeded <= 0).length
              const hasError = siteVlans.length === 0 || invalidCount > 0
              return (
                <button
                  key={site.tempId}
                  type="button"
                  onClick={() => setActiveManualSite(site.tempId)}
                  title={hasError ? (siteVlans.length === 0 ? 'No VLANs defined' : `${invalidCount} VLAN(s) missing required fields`) : undefined}
                  className={`rounded-md border px-3 py-1.5 text-sm transition-colors ${
                    isActive
                      ? hasError
                        ? 'border-red-400 bg-red-500/10 text-red-600 dark:text-red-400'
                        : 'border-primary bg-primary/10 text-primary'
                      : hasError
                        ? 'border-red-400/50 text-red-600 dark:text-red-400 hover:bg-accent'
                        : 'border-border hover:bg-accent'
                  }`}
                >
                  {site.name || '(unnamed)'}
                  <span className="ml-1 text-xs text-muted-foreground">
                    ({siteVlans.length})
                  </span>
                </button>
              )
            })}
          </div>

          {/* Copy from another site */}
          {state.sites.length > 1 && (
            <div className="flex items-center gap-2">
              <Copy className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Copy VLANs from:</span>
              {state.sites
                .filter((s) => s.tempId !== activeManualSite)
                .map((site) => (
                  <button
                    key={site.tempId}
                    type="button"
                    onClick={() => copyVlansFrom(site.tempId)}
                    className="rounded-md border border-border px-2 py-0.5 text-xs hover:bg-accent transition-colors"
                  >
                    {site.name || '(unnamed)'}
                  </button>
                ))}
            </div>
          )}

          {/* Per-site VLAN list */}
          {activeManualSite && (
            <div className="space-y-3">
              {getManualVlans(activeManualSite).length === 0 && (
                <div className="rounded-md border border-dashed border-red-400 bg-red-500/5 p-4 text-center text-sm text-red-500">
                  No VLANs defined for this site. Add at least one VLAN.
                </div>
              )}
              {getManualVlans(activeManualSite).map((vlan) => {
                const nameEmpty = !vlan.name.trim()
                const hostsInvalid = vlan.hostsNeeded <= 0
                const hasFieldError = nameEmpty || hostsInvalid
                return (
                <div key={vlan.tempId} className={`rounded-md border p-3 space-y-2 ${hasFieldError ? 'border-red-400' : 'border-border'}`}>
                  <div className="grid grid-cols-4 gap-2">
                    <div>
                      <label className="text-xs font-medium">VLAN ID</label>
                      <input
                        type="number"
                        value={vlan.vlanId}
                        onChange={(e) =>
                          updateManualVlan(activeManualSite, vlan.tempId, 'vlanId', parseInt(e.target.value, 10) || 0)
                        }
                        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm font-mono"
                      />
                    </div>
                    <div>
                      <label className={`text-xs font-medium ${nameEmpty ? 'text-red-500' : ''}`}>
                        Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        value={vlan.name}
                        onChange={(e) =>
                          updateManualVlan(activeManualSite, vlan.tempId, 'name', e.target.value)
                        }
                        placeholder="e.g. Management"
                        className={`mt-1 w-full rounded-md border bg-background px-3 py-1.5 text-sm ${nameEmpty ? 'border-red-400' : 'border-input'}`}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium">Purpose</label>
                      <input
                        value={vlan.purpose}
                        onChange={(e) =>
                          updateManualVlan(activeManualSite, vlan.tempId, 'purpose', e.target.value)
                        }
                        placeholder="e.g. Network mgmt"
                        className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
                      />
                    </div>
                    <div className="flex items-end gap-1">
                      <div className="flex-1">
                        <label className={`text-xs font-medium ${hostsInvalid ? 'text-red-500' : ''}`}>
                          Hosts <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={vlan.hostsNeeded}
                          onChange={(e) =>
                            updateManualVlan(
                              activeManualSite,
                              vlan.tempId,
                              'hostsNeeded',
                              parseInt(e.target.value, 10) || 1,
                            )
                          }
                          className={`mt-1 w-full rounded-md border bg-background px-3 py-1.5 text-sm ${hostsInvalid ? 'border-red-400' : 'border-input'}`}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeManualVlan(activeManualSite, vlan.tempId)}
                        className="p-1.5 rounded hover:bg-destructive/10 mb-0.5"
                        title="Remove"
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </div>
                  </div>
                </div>
                )
              })}

              <button
                type="button"
                onClick={() => addManualVlan(activeManualSite)}
                className="flex items-center gap-2 rounded-md border border-dashed border-border px-4 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors w-full justify-center"
              >
                <Plus className="h-4 w-4" />
                Add VLAN
              </button>
            </div>
          )}
        </>
      )}

      {!valid && (
        <div className="rounded-md border border-red-400/50 bg-red-500/5 px-4 py-2.5 text-sm text-red-600 dark:text-red-400">
          {isManual ? (() => {
            const noVlanSites = state.sites.filter((s) => getManualVlans(s.tempId).length === 0)
            const incompleteSites = state.sites.filter((s) => {
              const vlans = getManualVlans(s.tempId)
              return vlans.length > 0 && vlans.some((v) => !v.name.trim() || v.hostsNeeded <= 0)
            })
            const allEmpty = !state.sites.some((s) => getManualVlans(s.tempId).length > 0)
            if (allEmpty) return 'Add at least one VLAN to at least one site to continue.'
            const parts: string[] = []
            if (incompleteSites.length > 0) {
              parts.push(`${incompleteSites.map((s) => s.name || '(unnamed)').join(', ')}: fill in required fields (Name, Hosts)`)
            }
            if (noVlanSites.length > 0 && noVlanSites.length < state.sites.length) {
              parts.push(`${noVlanSites.map((s) => s.name || '(unnamed)').join(', ')}: no VLANs (will be skipped)`)
            }
            return parts.join('. ') || 'Fix the errors above to continue.'
          })() : 'Add at least one VLAN template with a name and hosts count.'}
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
          disabled={!valid}
          onClick={onNext}
          className="rounded-md bg-primary px-6 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  )
}
