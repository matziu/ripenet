import { useQuery } from '@tanstack/react-query'
import { projectsApi } from '@/api/endpoints'
import type { WizardState } from '@/lib/wizard.types'

interface Props {
  state: WizardState
  onChange: (patch: Partial<WizardState>) => void
  onNext: () => void
}

export function WizardStepProject({ state, onChange, onNext }: Props) {
  const { data: projects } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.list(),
    select: (res) => res.data.results,
  })

  const valid =
    state.projectMode === 'new'
      ? state.projectName.trim() !== ''
      : state.projectId !== undefined

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold mb-1">Project Setup</h2>
        <p className="text-sm text-muted-foreground">
          Choose an existing project or create a new one.
        </p>
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => onChange({ projectMode: 'new', projectId: undefined })}
          className={`flex-1 rounded-md border px-4 py-3 text-sm font-medium transition-colors ${
            state.projectMode === 'new'
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border hover:bg-accent'
          }`}
        >
          New Project
        </button>
        <button
          type="button"
          onClick={() => onChange({ projectMode: 'existing' })}
          className={`flex-1 rounded-md border px-4 py-3 text-sm font-medium transition-colors ${
            state.projectMode === 'existing'
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border hover:bg-accent'
          }`}
        >
          Existing Project
        </button>
      </div>

      {state.projectMode === 'new' ? (
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium">Project Name</label>
            <input
              value={state.projectName}
              onChange={(e) => onChange({ projectName: e.target.value })}
              placeholder="e.g. Corporate WAN"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium">Description</label>
            <input
              value={state.projectDescription}
              onChange={(e) => onChange({ projectDescription: e.target.value })}
              placeholder="Optional description"
              className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
            />
          </div>
        </div>
      ) : (
        <div>
          <label className="text-xs font-medium">Select Project</label>
          <select
            value={state.projectId ?? ''}
            onChange={(e) => {
              const id = parseInt(e.target.value, 10)
              const proj = projects?.find((p) => p.id === id)
              onChange({
                projectId: id,
                supernet: proj?.supernet ?? state.supernet,
              })
            }}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm"
          >
            <option value="">Choose a project...</option>
            {projects?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} {p.supernet ? `(${p.supernet})` : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex justify-end">
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
