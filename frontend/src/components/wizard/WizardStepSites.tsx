import { Plus, Trash2, MapPin } from 'lucide-react'
import type { WizardState } from '@/lib/wizard.types'
import { tempId } from '@/lib/wizard.utils'

interface Props {
  state: WizardState
  onChange: (patch: Partial<WizardState>) => void
  onNext: () => void
  onBack: () => void
}

const CIDR_RE = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\/\d{1,2}$/
const COORDS_RE = /^\s*(-?\d+\.?\d*)\s*,\s*(-?\d+\.?\d*)\s*$/

export function WizardStepSites({ state, onChange, onNext, onBack }: Props) {
  const addSite = () => {
    onChange({
      sites: [...state.sites, { tempId: tempId(), name: '', address: '', supernet: '', latitude: null, longitude: null }],
    })
  }

  const removeSite = (id: string) => {
    onChange({ sites: state.sites.filter((s) => s.tempId !== id) })
  }

  const updateSite = (id: string, field: 'name' | 'address' | 'supernet', value: string) => {
    onChange({
      sites: state.sites.map((s) =>
        s.tempId === id ? { ...s, [field]: value } : s,
      ),
    })
  }

  const coordsDisplayText = (site: { latitude: number | null; longitude: number | null }) =>
    site.latitude != null && site.longitude != null
      ? `${site.latitude}, ${site.longitude}`
      : ''

  const updateCoords = (id: string, raw: string) => {
    const match = COORDS_RE.exec(raw)
    if (match) {
      const lat = parseFloat(match[1])
      const lng = parseFloat(match[2])
      onChange({
        sites: state.sites.map((s) =>
          s.tempId === id ? { ...s, latitude: lat, longitude: lng } : s,
        ),
      })
    } else if (raw.trim() === '') {
      onChange({
        sites: state.sites.map((s) =>
          s.tempId === id ? { ...s, latitude: null, longitude: null } : s,
        ),
      })
    }
  }

  const toggleSiteSupernets = (enabled: boolean) => {
    onChange({ siteSupernetsEnabled: enabled })
  }

  const valid =
    state.sites.length >= 1 &&
    state.sites.every((s) => s.name.trim() !== '') &&
    (state.siteSupernetsEnabled
      ? state.sites.every((s) => s.supernet.trim() !== '' && CIDR_RE.test(s.supernet.trim()))
      : state.supernet.trim() !== '' && CIDR_RE.test(state.supernet.trim()))

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">Sites & Address Space</h2>
        <p className="text-sm text-muted-foreground">
          Define the supernet and physical locations. Each site will receive its own set of VLANs and subnets.
          {' '}Add at least 2 sites if you plan to configure tunnels.
        </p>
      </div>

      <div>
        <label className="text-xs font-medium">Supernet CIDR {!state.siteSupernetsEnabled && <span className="text-red-500">*</span>}</label>
        <input
          value={state.supernet}
          onChange={(e) => onChange({ supernet: e.target.value })}
          placeholder="e.g. 10.0.0.0/16"
          className={`mt-1 w-full rounded-md border bg-background px-3 py-1.5 text-sm font-mono ${
            state.supernet.trim() && !CIDR_RE.test(state.supernet.trim())
              ? 'border-destructive'
              : 'border-input'
          }`}
        />
        <p className="text-xs text-muted-foreground mt-1">
          The address block to subdivide for all sites and VLANs.
        </p>
      </div>

      <div className="space-y-3">
        {state.sites.map((site, idx) => (
          <div key={site.tempId}>
            <div className="flex items-start gap-2">
              <span className="mt-2 text-xs text-muted-foreground w-6 text-right shrink-0">
                {idx + 1}.
              </span>
              <input
                value={site.name}
                onChange={(e) => updateSite(site.tempId, 'name', e.target.value)}
                placeholder="Site name *"
                className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
              />
              <input
                value={site.address}
                onChange={(e) => updateSite(site.tempId, 'address', e.target.value)}
                placeholder="Address"
                className="min-w-0 flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
              />
              <div className="relative shrink-0">
                <input
                  defaultValue={coordsDisplayText(site)}
                  key={`${site.tempId}-${site.latitude}-${site.longitude}`}
                  onBlur={(e) => updateCoords(site.tempId, e.target.value)}
                  onPaste={(e) => {
                    const text = e.clipboardData.getData('text')
                    if (COORDS_RE.test(text)) {
                      e.preventDefault()
                      e.currentTarget.value = text
                      updateCoords(site.tempId, text)
                    }
                  }}
                  placeholder="52.260, 20.921"
                  className="w-40 rounded-md border border-input bg-background pl-3 pr-7 py-1.5 text-sm font-mono"
                />
                <MapPin
                  className={`absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 ${
                    site.latitude != null && site.longitude != null
                      ? 'text-green-500'
                      : 'text-muted-foreground/40'
                  }`}
                />
              </div>
              {state.siteSupernetsEnabled && (
                <input
                  value={site.supernet}
                  onChange={(e) => updateSite(site.tempId, 'supernet', e.target.value)}
                  placeholder="Supernet *"
                  className={`w-40 shrink-0 rounded-md border bg-background px-3 py-1.5 text-sm font-mono ${
                    site.supernet.trim() && !CIDR_RE.test(site.supernet.trim())
                      ? 'border-destructive'
                      : !site.supernet.trim()
                        ? 'border-destructive/50'
                        : 'border-input'
                  }`}
                />
              )}
              <button
                type="button"
                onClick={() => removeSite(site.tempId)}
                className="p-1.5 rounded hover:bg-destructive/10 mt-0.5 shrink-0"
                title="Remove"
              >
                <Trash2 className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addSite}
        className="flex items-center gap-2 rounded-md border border-dashed border-border px-4 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground transition-colors w-full justify-center"
      >
        <Plus className="h-4 w-4" />
        Add Site
      </button>

      {/* Per-site supernet toggle */}
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={state.siteSupernetsEnabled}
          onChange={(e) => toggleSiteSupernets(e.target.checked)}
          className="rounded border-input"
        />
        <span>
          Per-site supernet override
          {state.supernet && (
            <span className="text-muted-foreground"> (default: {state.supernet})</span>
          )}
        </span>
      </label>

      {state.siteSupernetsEnabled && (
        <p className="text-xs text-muted-foreground -mt-4">
          Each site requires its own supernet. The global supernet above becomes optional.
        </p>
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
