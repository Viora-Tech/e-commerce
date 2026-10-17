import { CircleCheck, Clock, InfoIcon, TriangleAlert } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import type { ReactNode } from 'react'

export type SyncTone = 'ok' | 'pending' | 'idle' | 'error'

type SyncStatusBarProps = {
  tone: SyncTone
  title: string
  detail?: ReactNode
  /** Right side: "Updated 6 min ago". */
  meta?: ReactNode
  action?: ReactNode
}

const ICON = { ok: CircleCheck, pending: Clock, idle: InfoIcon, error: TriangleAlert }
const ICON_TONE = {
  ok: 'text-success',
  pending: 'text-warning-foreground dark:text-warning',
  idle: 'text-muted-foreground',
  error: 'text-danger',
}

/**
 * Figma "Sync status bar": one line under a channel's header saying whether the catalog is
 * shared, waiting, stopped or not connected, with the one thing to do about it.
 */
export default function SyncStatusBar({ tone, title, detail, meta, action }: SyncStatusBarProps) {
  // Render logic
  const Icon = ICON[tone]
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={cn(
        'flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border bg-card bg-[image:var(--card-surface)] px-4 py-3 shadow-[var(--shadow-card)]',
        tone === 'error' ? 'border-danger/40' : 'border-border',
      )}
    >
      <Icon className={cn('size-4 shrink-0', ICON_TONE[tone])} />
      <p className="min-w-0 flex-1 text-body">
        <span className="font-medium text-ink-strong">{title}</span>
        {detail ? <span className="ml-2 text-muted-foreground">{detail}</span> : null}
      </p>
      {meta ? <span className="text-caption text-muted-foreground">{meta}</span> : null}
      {action}
    </div>
  )
}
