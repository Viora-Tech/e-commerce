import { CheckIcon } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Fragment } from 'react'

export type FlowStep = 'package' | 'courier' | 'review' | 'done'

type FlowStepsProps = {
  steps: readonly FlowStep[]
  current: FlowStep
  labels: Record<FlowStep, string>
}

/** The Create shipment stepper: Package → Courier → Review → Booked, done steps ticked. */
export default function FlowSteps({ steps, current, labels }: FlowStepsProps) {
  // Render logic
  const at = steps.indexOf(current)

  return (
    <ol className="flex items-center gap-2 text-caption">
      {steps.map((step, i) => {
        const done = i < at || current === 'done'
        const active = i === at && current !== 'done'
        return (
          <Fragment key={step}>
            {i > 0 ? (
              <li aria-hidden className={cn('h-px flex-1', done ? 'bg-primary' : 'bg-border')} />
            ) : null}
            <li
              aria-current={active ? 'step' : undefined}
              className={cn(
                'flex items-center gap-1.5 whitespace-nowrap',
                active ? 'font-medium text-ink-strong' : 'text-muted-foreground',
              )}
            >
              <span
                className={cn(
                  'flex size-5 items-center justify-center rounded-full border text-caption [&_svg]:size-3',
                  done && 'border-primary bg-primary text-primary-foreground',
                  active && 'border-primary text-primary',
                )}
              >
                {done ? <CheckIcon aria-hidden /> : i + 1}
              </span>
              {labels[step]}
            </li>
          </Fragment>
        )
      })}
    </ol>
  )
}
