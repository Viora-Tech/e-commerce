import { CircleCheck, type IconComponent } from '@commerce/ui/icons'

type ChoiceCardProps = {
  icon?: IconComponent
  label: string
  /** A short line under the label, for picture cards that need a hint. */
  description?: string | undefined
  selected: boolean
  onSelect: () => void
  /** `tile`: icon above the label, for picture grids. `row`: icon beside it, for lists. */
  layout: 'tile' | 'row'
  disabled?: boolean
  /** Shows a check at the right edge of the chosen card (`row` layout). */
  showCheck?: boolean
}

const BASE =
  'flex rounded-xl border bg-card text-left text-body text-foreground transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/40 disabled:opacity-60'

/**
 * One tappable answer to a one-question screen (onboarding, "What do you want to make?"):
 * a toggle button that looks like a card.
 */
export default function ChoiceCard({
  icon: Icon,
  label,
  description,
  selected,
  onSelect,
  layout,
  disabled,
  showCheck = false,
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
      {Icon ? (
        <Icon
          className={`size-6 shrink-0 ${selected ? 'text-primary' : 'text-muted-foreground'}`}
        />
      ) : null}
      <span className={`flex flex-col gap-0.5 ${showCheck ? 'min-w-0 flex-1' : ''}`}>
        <span className="font-medium">{label}</span>
        {description ? (
          <span className="text-caption text-muted-foreground">{description}</span>
        ) : null}
      </span>
      {showCheck && selected ? (
        <CircleCheck aria-hidden="true" className="size-5 shrink-0 text-primary" />
      ) : null}
    </button>
  )
}
