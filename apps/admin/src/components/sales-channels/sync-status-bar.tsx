import { CircleCheck, Clock, InfoIcon, TriangleAlert } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Alert, AlertDescription, AlertTitle } from '@commerce/ui/shadcn/alert'
import type { ReactNode } from 'react'

export type SyncTone = 'ok' | 'pending' | 'idle' | 'error'

type SyncStatusBarProps = {
  tone: SyncTone
  title: string
  detail?: ReactNode
  /** Right side: "Updated 6 min ago". */
  meta?: ReactNode
  action?: ReactNode
  /** 0–1 while a sync is sending products; draws the bar beside the meta. */
  progress?: number | null
}

const ICON = { ok: CircleCheck, pending: Clock, idle: InfoIcon, error: TriangleAlert }
/** The banner tone for each sync state: shared green, waiting amber, stopped red. */
const ALERT_TONE = { ok: 'success', pending: 'warning', idle: 'neutral', error: 'danger' } as const

/**
 * Figma "Sync status bar": one banner under a channel's header saying whether the catalog is
 * shared, waiting, stopped or not connected, with the one thing to do about it. Drawn with the
 * shared Alert; the progress bar and "Updated …" sit with the action at the end.
 */
export default function SyncStatusBar({
  tone,
  title,
  detail,
  meta,
  action,
  progress,
}: SyncStatusBarProps) {
  // Render logic
  const Icon = ICON[tone]
  const end =
    progress != null || meta || action ? (
      <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
        {progress != null ? (
          <span
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress > 0 ? Math.round(progress * 100) : undefined}
            className="h-1.5 w-32 overflow-hidden rounded-full bg-muted"
          >
            {/* Nothing counted yet: a pulsing bar says it is working rather than stuck at 0. */}
            <span
              className={cn(
                'block h-full rounded-full bg-primary transition-[width] duration-500',
                progress > 0 ? '' : 'animate-pulse opacity-60',
              )}
              style={{ width: progress > 0 ? `${Math.round(progress * 100)}%` : '100%' }}
            />
          </span>
        ) : null}
        {meta ? <span className="text-caption text-muted-foreground">{meta}</span> : null}
        {action}
      </div>
    ) : undefined

  return (
    // Only a stopped sync interrupts a screen reader; the other states are read politely.
    <Alert tone={ALERT_TONE[tone]} role={tone === 'error' ? 'alert' : 'status'} action={end}>
      <Icon />
      <AlertTitle className="text-ink-strong">{title}</AlertTitle>
      {detail ? <AlertDescription>{detail}</AlertDescription> : null}
    </Alert>
  )
}
