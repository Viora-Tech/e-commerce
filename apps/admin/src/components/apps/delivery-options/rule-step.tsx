import type { ReactNode } from 'react'

type RuleStepProps = {
  /** 1 to 4: the step's number. */
  step: number
  title: string
  help?: string | undefined
  children: ReactNode
  /** The heading's id; set it when another set of steps can share the page. */
  id?: string
}

/**
 * One numbered question of the product rule dialog (owner, 20 Nov 2026): "1 Which products?",
 * "2 Which couriers can carry them?", "3 Which courier is included in the price?", "4 What does
 * it cost?". Also the 3 delivery price questions on the Options page (owner, 21 Nov 2026).
 */
export default function RuleStep({ step, title, help, children, id }: RuleStepProps) {
  // Render logic
  const headingId = id ?? `rule-step-${step}`

  return (
    <fieldset aria-labelledby={headingId} className="flex min-w-0 gap-3">
      <span
        aria-hidden
        className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-caption font-semibold text-ink-strong"
      >
        {step}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <h3 id={headingId} className="text-body font-medium text-ink-strong">
          <span className="sr-only">{`${step}. `}</span>
          {title}
        </h3>
        {help ? <p className="text-caption text-muted-foreground">{help}</p> : null}
        {children}
      </div>
    </fieldset>
  )
}
