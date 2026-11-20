import type { ReactNode } from 'react'

type RuleStepProps = {
  /** 1 to 4: the step's number. */
  step: number
  title: string
  help?: string | undefined
  children: ReactNode
}

/**
 * One numbered question of the product rule dialog (owner, 20 Nov 2026): "1 Which products?",
 * "2 Which couriers can carry them?", "3 Which courier is included in the price?", "4 What does
 * it cost?".
 */
export default function RuleStep({ step, title, help, children }: RuleStepProps) {
  return (
    <div role="group" aria-labelledby={`rule-step-${step}`} className="flex gap-3">
      <span
        aria-hidden
        className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-caption font-semibold text-ink-strong"
      >
        {step}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <h3 id={`rule-step-${step}`} className="text-body font-medium text-ink-strong">
          <span className="sr-only">{`${step}. `}</span>
          {title}
        </h3>
        {help ? <p className="text-caption text-muted-foreground">{help}</p> : null}
        {children}
      </div>
    </div>
  )
}
