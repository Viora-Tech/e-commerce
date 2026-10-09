import { cn } from '@commerce/ui/lib/utils'

type AutomationFlowNodeProps = {
  kind: string
  title: string
  description?: string
  selected: boolean
  onSelect: () => void
}

/** One card of the flow canvas: its kind, what it does in a line, a blue ring when selected. */
export default function AutomationFlowNode({
  kind,
  title,
  description,
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
        'flex w-full max-w-[22rem] flex-col gap-1 rounded-lg bg-card p-4 text-left shadow-card transition-shadow hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        selected && 'shadow-[inset_0_0_0_1px_var(--primary)]',
      )}
    >
      <span className="text-caption text-muted-foreground">{kind}</span>
      <span className="text-body-strong text-ink-strong">{title}</span>
      {description ? (
        <span className="line-clamp-2 text-caption text-muted-foreground">{description}</span>
      ) : null}
    </button>
  )
}
