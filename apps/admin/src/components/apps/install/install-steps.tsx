import { CheckIcon } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Fragment } from 'react'

type InstallStepsProps = {
  /** Step labels in order. */
  steps: string[]
  /** Index of the step on screen; earlier ones show a tick. */
  current: number
}

/** The install flow's stepper (Figma "Connect account — Permissions — Done"). */
export default function InstallSteps({ steps, current }: InstallStepsProps) {
  return (
    <ol className="flex items-center gap-2">
      {steps.map((label, i) => (
        <Fragment key={label}>
          {i > 0 ? <li aria-hidden="true" className="h-px w-6 shrink-0 bg-border" /> : null}
          <li
            aria-current={i === current ? 'step' : undefined}
            className="flex items-center gap-2 text-caption whitespace-nowrap"
          >
            <span
              className={cn(
                'flex size-5 items-center justify-center rounded-full text-[0.6875rem] font-medium',
                i < current && 'bg-success-soft text-success',
                i === current && 'bg-foreground text-background',
                i > current && 'bg-muted text-muted-foreground',
              )}
            >
              {i < current ? <CheckIcon aria-hidden="true" className="size-3" /> : i + 1}
            </span>
            <span className={i === current ? 'text-foreground' : 'text-muted-foreground'}>
              {label}
            </span>
          </li>
        </Fragment>
      ))}
    </ol>
  )
}
