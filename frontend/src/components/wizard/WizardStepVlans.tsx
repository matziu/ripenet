import { useState } from 'react'
import { Plus, Trash2, Settings2 } from 'lucide-react'
import type { WizardState, WizardSiteOverride } from '@/lib/wizard.types'
import { tempId, getVlanIdForSite } from '@/lib/wizard.utils'

interface Props {
  state: WizardState
  onChange: (patch: Partial<WizardState>) => void
  onNext: () => void
  onBack: () => void
}

export function WizardStepVlans({ state, onChange, onNext, onBack }: Props) {
  const [showOverrides, setShowOverrides] = useState(false)

  /** Re-number all template VLAN IDs from current start/step */
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

  const valid =
    state.vlanTemplates.length >= 1 &&
    state.vlanTemplates.every((t) => t.name.trim() !== '' && t.hostsNeeded > 0)

  const isPerSite = state.vlanNumbering === 'per-site'

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">VLAN Templates</h2>
        <p className="text-sm text-muted-foreground">
          Define VLAN templates that will be replicated across all sites. Specify the number of
          hosts needed per VLAN for automatic subnet sizing.
        </p>
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
                <label className="text-xs font-medium">Name</label>
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
                  <label className="text-xs font-medium">Hosts</label>
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
