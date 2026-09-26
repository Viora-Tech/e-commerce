import { CircleAlert, CircleCheck } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import type { ReactNode } from 'react'

export type HealthTone = 'ok' | 'warn' | 'bad'

type HealthLineProps = {
  tone: HealthTone
  title: string
  help?: string | null | undefined
  /** The one-click fix, e.g. a Connect button. */
  action?: ReactNode
}

const BOX: Record<HealthTone, string> = {
  ok: 'border-success/30 bg-success-soft',
  warn: 'border-warning/40 bg-warning-soft',
  bad: 'border-destructive/30 bg-destructive/5',
}

const ICON: Record<HealthTone, string> = {
  ok: 'text-success',
  warn: 'text-warning-foreground dark:text-warning',
  bad: 'text-destructive',
}

/** The one status line at the top of a settings page: is this working, and if not, the fix. */
export default function HealthLine({ tone, title, help, action }: HealthLineProps) {
  // Render logic
  const Icon = tone === 'ok' ? CircleCheck : CircleAlert

  return (
    <div
      role="status"
      className={cn(
        'flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center',
        BOX[tone],
      )}
    >
      <div className="flex flex-1 items-start gap-3">
        <Icon
          aria-hidden="true"
          weight="fill"
          className={cn('mt-0.5 size-5 shrink-0', ICON[tone])}
        />
        <div className="flex flex-col gap-0.5">
          <p className="text-body font-semibold text-foreground">{title}</p>
          {help ? <p className="text-body text-muted-foreground">{help}</p> : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}
