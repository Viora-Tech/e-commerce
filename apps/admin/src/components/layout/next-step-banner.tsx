import { cn } from '@commerce/ui/lib/utils'
import { Alert, type AlertTone } from '@commerce/ui/shadcn/alert'
import type { ReactNode } from 'react'

/** action: work to do (blue). attention: a decision waiting on you (amber). done / closed. */
export type NextStepTone = 'action' | 'attention' | 'done' | 'closed'

type NextStepBannerProps = {
  tone: NextStepTone
  /** The small mono line above the title ("NEXT STEP", "YOUR DECISION"). */
  eyebrow: string
  title: ReactNode
  body: ReactNode
  icon: ReactNode
  actions?: ReactNode
  /** Anything under the row (transit steps). */
  extra?: ReactNode
}

/* Drawn with the one banner (`Alert`, audit step 10): work to do in the info tint, a decision in
   the warning tint, done in the success tint, closed quiet. */
const ALERT_TONE: Record<NextStepTone, AlertTone> = {
  action: 'info',
  attention: 'warning',
  done: 'success',
  closed: 'neutral',
}

const TILE: Record<NextStepTone, string> = {
  action: 'border-primary/20 bg-primary-soft text-primary',
  attention: 'border-warning/30 bg-warning-soft text-warning',
  done: 'border-transparent bg-success text-white',
  closed: 'border-primary/20 bg-primary-soft text-muted-foreground',
}

const EYEBROW: Record<NextStepTone, string> = {
  action: 'text-primary',
  attention: 'text-warning',
  done: 'text-success',
  closed: 'text-muted-foreground',
}

/** The one "what happens next" banner above a record's columns (orders, returns). */
export default function NextStepBanner({
  tone,
  eyebrow,
  title,
  body,
  icon,
  actions,
  extra,
}: NextStepBannerProps) {
  return (
    <Alert
      tone={ALERT_TONE[tone]}
      role="region"
      aria-label={eyebrow}
      className="flex flex-col items-stretch gap-4 p-4 md:px-5 print:hidden"
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={cn(
              'flex size-10 shrink-0 items-center justify-center rounded-lg border shadow-input [&_svg]:size-5',
              TILE[tone],
            )}
          >
            {icon}
          </span>
          <div className="flex min-w-0 flex-col gap-0.5">
            <span
              className={cn(
                'font-mono text-micro leading-4 font-medium tracking-[0.06em] uppercase',
                EYEBROW[tone],
              )}
            >
              {eyebrow}
            </span>
            <h2 className="text-xl leading-7 font-semibold tracking-[-0.01em] text-ink-strong">
              {title}
            </h2>
            <p className="text-caption font-normal leading-[1.1875rem] text-muted-foreground">
              {body}
            </p>
          </div>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {extra}
    </Alert>
  )
}
