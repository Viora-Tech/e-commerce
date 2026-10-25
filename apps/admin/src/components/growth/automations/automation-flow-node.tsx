import type { IconComponent } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'

type AutomationFlowNodeProps = {
  kind: string
  title: string
  description?: string | undefined
  icon: IconComponent
  /** Tint classes for the icon tile. */
  tone: string
  selected: boolean
  onSelect: () => void
}

/** One card of the flow canvas: an icon tile, its kind, what it does in a line, a ring when selected. */
export default function AutomationFlowNode({
  kind,
  title,
  description,
  icon: Icon,
  tone,
  selected,
  onSelect,
}: AutomationFlowNodeProps) {
  // Render logic
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'flex w-72 flex-col gap-2 rounded-lg surface-card p-3 text-left transition-shadow hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selected && 'shadow-[inset_0_0_0_1px_var(--primary)]',
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
          <span className="truncate text-body-strong text-ink-strong">{title}</span>
        </span>
      </span>
      {description ? (
        <span className="line-clamp-2 text-caption text-muted-foreground">{description}</span>
      ) : null}
    </button>
  )
}
