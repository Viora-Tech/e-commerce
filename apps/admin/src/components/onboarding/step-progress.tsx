import { ArrowLeft } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { onboardingContent } from '@/data/onboarding'
import { useCopy } from '@/hooks/use-copy'

type StepProgressProps = {
  /** Zero-based. */
  step: number
  total: number
  /** Omitted on the first screen, where there is nothing to go back to. */
  onBack?: (() => void) | undefined
  disabled?: boolean
}

/** Progress dots plus a back button, above each onboarding question. */
export default function StepProgress({ step, total, onBack, disabled }: StepProgressProps) {
  // Hooks
  const copy = useCopy(onboardingContent)

  // Render logic
  const dots = Array.from({ length: total }, (_, i) => i)

  return (
    <div className="flex h-8 items-center justify-between">
      {onBack ? (
        <Button type="button" variant="ghost" size="sm" onClick={onBack} disabled={disabled}>
          <ArrowLeft className="size-4" />
          {copy.back}
        </Button>
      ) : (
        <span />
      )}
      <div
        className="flex items-center gap-1.5"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={step + 1}
        aria-label={copy.progress(step + 1, total)}
      >
        {dots.map((i) => (
          <span
            key={i}
            className={`h-2 rounded-full transition-all ${
              i === step ? 'w-5 bg-primary' : i < step ? 'w-2 bg-primary/60' : 'w-2 bg-muted'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
