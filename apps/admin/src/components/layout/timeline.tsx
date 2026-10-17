import { cn } from '@commerce/ui/lib/utils'
import type { ComponentType, ReactNode } from 'react'
import RelativeTime from './relative-time'

export type TimelineTone = 'neutral' | 'success' | 'danger' | 'pending'

export type TimelineItem = {
  id: string
  title: ReactNode
  detail?: ReactNode
  /** When it happened; shown as a relative time unless `time` replaces it. */
  at?: Date | string | null
  /** Text in place of the relative time ("Pending", a formatted date). */
  time?: ReactNode
  icon?: ComponentType<{ className?: string }>
  tone?: TimelineTone
  /** Keep the title's line breaks (notes). */
  preserveLines?: boolean
}

export type TimelineGroup = { key: string; label: string; items: TimelineItem[] }

type TimelineProps = {
  /**
   * rail: icon markers on a vertical line (order history, activity).
   * steps: done / pending dots (a process such as a return).
   * compact: a small dot, the label and its time on one line.
   */
  variant?: 'rail' | 'steps' | 'compact'
  items?: TimelineItem[]
  /** Items grouped under sticky day labels (rail only). */
  groups?: TimelineGroup[]
  className?: string
}

type EntryProps = { item: TimelineItem }

const MARKER_TONE: Record<TimelineTone, string> = {
  neutral: 'text-muted-foreground',
  success: 'text-success',
  danger: 'text-destructive',
  pending: 'text-muted-foreground-soft',
}

const STEP_DOT: Record<TimelineTone, string> = {
  neutral: 'bg-muted-foreground',
  success: 'bg-success',
  danger: 'bg-danger',
  pending: 'border border-border-strong bg-card',
}

function When({ item, className }: EntryProps & { className?: string }) {
  if (item.time !== undefined) return <span className={className}>{item.time}</span>
  if (!item.at) return null
  return <RelativeTime value={item.at} className={className} />
}

function RailEntry({ item }: EntryProps) {
  const Icon = item.icon
  return (
    <li className="relative">
      <span
        className={cn(
          'absolute -left-8 top-0 flex size-6 items-center justify-center rounded-full border border-border bg-card',
          MARKER_TONE[item.tone ?? 'neutral'],
        )}
        aria-hidden="true"
      >
        {Icon ? (
          <Icon className="size-3.5" />
        ) : (
          <span className="size-1.5 rounded-full bg-current" />
        )}
      </span>
      <p className={cn('text-body', item.preserveLines ? 'whitespace-pre-wrap' : 'font-medium')}>
        {item.title}
      </p>
      <When item={item} className="text-caption font-normal text-muted-foreground" />
      {item.detail ? <p className="text-caption text-muted-foreground">{item.detail}</p> : null}
    </li>
  )
}

function StepEntry({ item }: EntryProps) {
  const tone = item.tone ?? 'neutral'
  return (
    <li className="flex items-start gap-3">
      <span
        aria-hidden="true"
        className={cn('mt-1.5 size-2.5 shrink-0 rounded-full', STEP_DOT[tone])}
      />
      <span className="flex flex-col">
        <span
          className={cn(
            'text-body',
            tone === 'pending' ? 'text-muted-foreground' : 'text-foreground',
          )}
        >
          {item.title}
        </span>
        <When item={item} className="text-caption text-muted-foreground" />
      </span>
    </li>
  )
}

function CompactEntry({ item }: EntryProps) {
  return (
    <li className="flex items-center gap-3 text-body">
      <span className="size-1.5 shrink-0 rounded-full bg-muted-foreground" aria-hidden="true" />
      <span className="min-w-0 flex-1">{item.title}</span>
      <When item={item} className="shrink-0 text-caption text-muted-foreground tabular-nums" />
    </li>
  )
}

function Rail({ items }: { items: TimelineItem[] }) {
  return (
    <ol className="relative flex flex-col gap-4 border-l border-border pl-6">
      {items.map((item) => (
        <RailEntry key={item.id} item={item} />
      ))}
    </ol>
  )
}

/** The one timeline: order history, activity feeds and step-by-step progress. */
export default function Timeline({
  variant = 'rail',
  items = [],
  groups,
  className,
}: TimelineProps) {
  // Early returns
  if (variant === 'rail' && groups) {
    return (
      <div className={cn('flex flex-col gap-5', className)}>
        {groups.map((g) => (
          <section key={g.key}>
            <p className="sticky top-[var(--detail-header-height,0rem)] z-1 -mx-5 bg-card px-5 py-1 text-caption text-muted-foreground">
              {g.label}
            </p>
            <div className="mt-2">
              <Rail items={g.items} />
            </div>
          </section>
        ))}
      </div>
    )
  }
  if (variant === 'rail') {
    return (
      <div className={className}>
        <Rail items={items} />
      </div>
    )
  }

  // Render logic
  const Entry = variant === 'steps' ? StepEntry : CompactEntry

  return (
    <ol className={cn('flex flex-col gap-3', className)}>
      {items.map((item) => (
        <Entry key={item.id} item={item} />
      ))}
    </ol>
  )
}
