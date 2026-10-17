import { cn } from '@commerce/ui/lib/utils'
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

/* Figma "Order · Next step": an open step is the raised glass card; done the success tint,
   closed a quiet muted card. */
const CARD: Record<NextStepTone, string> = {
  action: 'border-transparent surface-glass',
  attention: 'border-transparent surface-glass',
  done: 'border-success-border bg-success-soft',
  closed: 'border-border bg-muted/60',
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
    <section
      aria-label={eyebrow}
      className={cn('flex flex-col gap-4 rounded-xl border p-4 md:px-5 print:hidden', CARD[tone])}
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
                'font-mono text-[0.6875rem] leading-4 font-medium tracking-[0.06em] uppercase',
                EYEBROW[tone],
              )}
            >
              {eyebrow}
            </span>
            <h2 className="text-xl leading-7 font-semibold tracking-[-0.01em] text-ink-strong">
              {title}
            </h2>
            <p className="text-[0.8125rem] leading-[1.1875rem] text-muted-foreground">{body}</p>
          </div>
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {extra}
    </section>
  )
}
