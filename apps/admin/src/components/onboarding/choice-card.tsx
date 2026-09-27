import type { IconComponent } from '@commerce/ui/icons'

type ChoiceCardProps = {
  icon: IconComponent
  label: string
  selected: boolean
  onSelect: () => void
  /** `tile`: icon above the label, for picture grids. `row`: icon beside it, for lists. */
  layout: 'tile' | 'row'
  disabled?: boolean
}

const BASE =
  'flex rounded-xl border bg-card text-left text-body text-foreground transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/40 disabled:opacity-60'

/** One tappable answer in an onboarding question: a toggle button that looks like a card. */
export default function ChoiceCard({
  icon: Icon,
  label,
  selected,
  onSelect,
  layout,
  disabled,
}: ChoiceCardProps) {
  // Render logic
  const state = selected
    ? 'border-primary bg-primary-soft text-ink-strong'
    : 'border-input hover:border-border-strong hover:bg-muted/60'
  const shape =
    layout === 'tile'
      ? 'min-h-24 flex-col items-start justify-between gap-3 p-3.5'
      : 'min-h-12 items-center gap-3 px-3.5 py-3'

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      disabled={disabled}
      className={`${BASE} ${shape} ${state}`}
    >
      <Icon className={`size-6 shrink-0 ${selected ? 'text-primary' : 'text-muted-foreground'}`} />
      <span className="font-medium">{label}</span>
    </button>
  )
}
