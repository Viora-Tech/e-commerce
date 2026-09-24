import { CircleCheck } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import IconBadge from '@/components/layout/icon-badge'

export type SetupStep = { label: string; done: boolean; href?: string; action?: string }

type SetupChecklistProps = {
  heading: string
  body: string
  steps: SetupStep[]
}

/**
 * First-run guidance: shown at the top of an installed app's first page while
 * something it needs (a GSTIN, a connected store) is still missing.
 */
export default function SetupChecklist({ heading, body, steps }: SetupChecklistProps) {
  if (steps.every((s) => s.done)) return null

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-info/30 bg-info-soft p-5">
      <div className="flex items-start gap-3">
        <IconBadge icon={CircleCheck} tone="info" />
        <div className="flex flex-col gap-1">
          <h2 className="text-card-title text-ink-strong">{heading}</h2>
          <p className="text-body text-muted-foreground">{body}</p>
        </div>
      </div>
      <ul className="flex flex-col gap-2">
        {steps.map((step) => (
          <li
            key={step.label}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-background px-3 py-2.5"
          >
            <span className="flex items-center gap-2 text-body">
              <CircleCheck
                className={cn('size-4', step.done ? 'text-success' : 'text-muted-foreground-soft')}
                weight={step.done ? 'fill' : 'regular'}
                aria-hidden="true"
              />
              {step.label}
            </span>
            {!step.done && step.href && step.action ? (
              <Button size="sm" variant="outline" render={<Link href={step.href} />}>
                {step.action}
              </Button>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )
}
