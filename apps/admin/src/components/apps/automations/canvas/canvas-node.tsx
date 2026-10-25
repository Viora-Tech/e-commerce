import { CircleAlert, type IconComponent, Lock, Send, ShieldCheck } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import type { NodeMark } from './types'

type CanvasNodeProps = {
  /** `'trigger'` or the node id; also the `data-node-id` the canvas keyboard moves between. */
  id: string
  kind: string
  title: string
  detail?: string | null | undefined
  icon: IconComponent
  tone: string
  selected: boolean
  flagged?: boolean | undefined
  asks?: boolean | undefined
  sensitive?: boolean | undefined
  messages?: boolean | undefined
  mark?: NodeMark | 'unreached' | undefined
  labels: { issue: string; asks: string; sensitive: string; messages: string }
  onSelect: (id: string) => void
}

const MARK_RING: Record<NodeMark | 'unreached', string> = {
  ran: 'shadow-[inset_0_0_0_2px_var(--success)]',
  failed: 'shadow-[inset_0_0_0_2px_var(--danger)]',
  waiting: 'shadow-[inset_0_0_0_2px_var(--warning)]',
  skipped: 'opacity-70',
  unreached: 'opacity-45',
}

function Badge({
  icon: Icon,
  label,
  className,
}: {
  icon: IconComponent
  label: string
  className: string
}) {
  return (
    <span
      className={cn(
        'inline-flex h-5 items-center gap-1 rounded-[0.375rem] px-1.5 text-[0.6875rem] font-medium [&_svg]:size-3',
        className,
      )}
    >
      <Icon aria-hidden="true" />
      {label}
    </span>
  )
}

/** One card on the workflow canvas: glyph, kind, what it does, risk badges, a ring when picked. */
export default function CanvasNode({
  id,
  kind,
  title,
  detail,
  icon: Icon,
  tone,
  selected,
  flagged = false,
  asks = false,
  sensitive = false,
  messages = false,
  mark,
  labels,
  onSelect,
}: CanvasNodeProps) {
  // Render logic
  const hasBadges = flagged || asks || sensitive || messages

  return (
    <button
      type="button"
      data-node-id={id}
      onClick={() => onSelect(id)}
      aria-pressed={selected}
      aria-label={`${kind}: ${title}${flagged ? `. ${labels.issue}` : ''}`}
      className={cn(
        'flex w-72 shrink-0 flex-col gap-2 rounded-lg surface-card p-3 text-left transition-[box-shadow,opacity] hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selected && 'shadow-[inset_0_0_0_1.5px_var(--primary)]',
        flagged && !selected && 'shadow-[inset_0_0_0_1px_var(--danger)]',
        mark && MARK_RING[mark],
      )}
    >
      <span className="flex items-center gap-2.5">
        <span
          className={cn(
            'flex size-7 shrink-0 items-center justify-center rounded-md [&_svg]:size-4',
            tone,
          )}
        >
          <Icon aria-hidden="true" />
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="text-eyebrow text-muted-foreground">{kind}</span>
          <span className="line-clamp-2 text-body-strong text-ink-strong">{title}</span>
        </span>
      </span>
      {detail ? (
        <span className="line-clamp-2 text-caption text-muted-foreground">{detail}</span>
      ) : null}
      {hasBadges ? (
        <span className="flex flex-wrap gap-1">
          {flagged ? (
            <Badge icon={CircleAlert} label={labels.issue} className="bg-danger-soft text-danger" />
          ) : null}
          {asks ? (
            <Badge
              icon={ShieldCheck}
              label={labels.asks}
              className="bg-warning-soft text-warning-foreground dark:text-warning"
            />
          ) : null}
          {sensitive ? (
            <Badge icon={Lock} label={labels.sensitive} className="bg-muted text-foreground" />
          ) : null}
          {messages ? (
            <Badge icon={Send} label={labels.messages} className="bg-info-soft text-info" />
          ) : null}
        </span>
      ) : null}
    </button>
  )
}
