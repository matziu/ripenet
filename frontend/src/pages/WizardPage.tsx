import { useState, useCallback } from 'react'
import { Check } from 'lucide-react'
import { WizardStepProject } from '@/components/wizard/WizardStepProject'
import { WizardStepSites } from '@/components/wizard/WizardStepSites'
import { WizardStepVlans } from '@/components/wizard/WizardStepVlans'
import { WizardStepAddressPlan } from '@/components/wizard/WizardStepAddressPlan'
import { WizardStepTunnels } from '@/components/wizard/WizardStepTunnels'
import { WizardStepReview } from '@/components/wizard/WizardStepReview'
import { initialWizardState } from '@/lib/wizard.types'
import type { WizardState } from '@/lib/wizard.types'

const steps = [
  { label: 'Project' },
  { label: 'Sites' },
  { label: 'VLANs' },
  { label: 'Address Plan' },
  { label: 'Tunnels' },
  { label: 'Review' },
]

export function WizardPage() {
  const [step, setStep] = useState(0)
  const [state, setState] = useState<WizardState>(initialWizardState)

  const onChange = useCallback((patch: Partial<WizardState>) => {
    setState((prev) => ({ ...prev, ...patch }))
  }, [])

  const onNext = () => setStep((s) => Math.min(s + 1, steps.length - 1))
  const onBack = () => setStep((s) => Math.max(s - 1, 0))

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Network Design Wizard</h1>

      {/* Stepper */}
      <div className="flex items-center mb-8">
        {steps.map((s, i) => (
          <div key={i} className="flex items-center flex-1 last:flex-none">
            <button
              type="button"
              onClick={() => i < step && setStep(i)}
              disabled={i > step}
              className="flex items-center gap-2 shrink-0"
            >
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium transition-colors ${
                  i < step
                    ? 'bg-primary text-primary-foreground'
                    : i === step
                      ? 'bg-primary text-primary-foreground ring-2 ring-primary/30 ring-offset-2 ring-offset-background'
                      : 'bg-muted text-muted-foreground'
                }`}
              >
                {i < step ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <span
                className={`text-sm hidden sm:inline ${
                  i === step ? 'font-medium' : 'text-muted-foreground'
                }`}
              >
                {s.label}
              </span>
            </button>
            {i < steps.length - 1 && (
              <div
                className={`h-px flex-1 mx-3 ${
                  i < step ? 'bg-primary' : 'bg-border'
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div className="rounded-lg border border-border bg-card p-6">
        {step === 0 && (
          <WizardStepProject state={state} onChange={onChange} onNext={onNext} />
        )}
        {step === 1 && (
          <WizardStepSites state={state} onChange={onChange} onNext={onNext} onBack={onBack} />
        )}
        {step === 2 && (
          <WizardStepVlans state={state} onChange={onChange} onNext={onNext} onBack={onBack} />
        )}
        {step === 3 && (
          <WizardStepAddressPlan state={state} onChange={onChange} onNext={onNext} onBack={onBack} />
        )}
        {step === 4 && (
          <WizardStepTunnels state={state} onChange={onChange} onNext={onNext} onBack={onBack} />
        )}
        {step === 5 && (
          <WizardStepReview state={state} onBack={onBack} />
        )}
      </div>
    </div>
  )
}
