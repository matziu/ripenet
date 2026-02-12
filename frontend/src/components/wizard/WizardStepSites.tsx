import { Plus, Trash2 } from 'lucide-react'
import type { WizardState } from '@/lib/wizard.types'
import { tempId } from '@/lib/wizard.utils'

interface Props {
  state: WizardState
  onChange: (patch: Partial<WizardState>) => void
  onNext: () => void
  onBack: () => void
}

export function WizardStepSites({ state, onChange, onNext, onBack }: Props) {
  const addSite = () => {
    onChange({
      sites: [...state.sites, { tempId: tempId(), name: '', address: '' }],
    })
  }

  const removeSite = (id: string) => {
    onChange({ sites: state.sites.filter((s) => s.tempId !== id) })
  }

  const updateSite = (id: string, field: 'name' | 'address', value: string) => {
    onChange({
      sites: state.sites.map((s) =>
        s.tempId === id ? { ...s, [field]: value } : s,
      ),
    })
  }

  const valid = state.sites.length >= 1 && state.sites.every((s) => s.name.trim() !== '')

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">Sites</h2>
        <p className="text-sm text-muted-foreground">
          Define the physical locations. Each site will receive its own set of VLANs and subnets.
          {' '}Add at least 2 sites if you plan to configure tunnels.
        </p>
      </div>

      <div className="space-y-3">
        {state.sites.map((site, idx) => (
          <div key={site.tempId} className="flex items-start gap-2">
            <span className="mt-2 text-xs text-muted-foreground w-6 text-right shrink-0">
              {idx + 1}.
            </span>
            <input
              value={site.name}
              onChange={(e) => updateSite(site.tempId, 'name', e.target.value)}
              placeholder="Site name (e.g. HQ)"
              className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
            />
            <input
              value={site.address}
              onChange={(e) => updateSite(site.tempId, 'address', e.target.value)}
              placeholder="Physical address (e.g. ul. Marszałkowska 1, Warszawa)"
              className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm"
            />
            <button
              type="button"
              onClick={() => removeSite(site.tempId)}
              className="p-1.5 rounded hover:bg-destructive/10 mt-0.5"
              title="Remove"
            >
              <Trash2 className="h-4 w-4 text-muted-foreground" />
            </button>
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
