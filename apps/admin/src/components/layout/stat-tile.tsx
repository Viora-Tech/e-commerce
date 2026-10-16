import { ArrowDown, ArrowUp } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'

type StatTileProps = {
  label: string
  /** Already formatted (money, count). */
  value: string
  /** Percent change against the previous period; the sign picks the arrow. */
  trend?: number | null
  /** Text after the arrow, e.g. "vs yesterday"; on its own (no trend) it is a plain note line. */
  trendNote?: string
  /** A rise is bad news (cancellations): the colours flip. */
  invert?: boolean
  /** A plain line under the figure when there is no trend ("56% of all customers"). */
  note?: string
  /** Makes the tile a filter button; `active` marks the current one. */
  onSelect?: () => void
  active?: boolean
  /** `strip`: one cell of a Figma "Stat strip" (no card of its own; the strip draws it). */
  variant?: 'card' | 'strip'
  className?: string
}

const BASE =
  'flex flex-col gap-1 rounded-lg surface-card p-4 text-left transition-[box-shadow,background-color] duration-150 ease-out'
/* Figma "Stat strip" cell: 16px inset, 6px gaps, 13px label, 28/34 semibold figure, a divider
   on the left of every cell after the first. */
const STRIP =
  'flex min-w-0 flex-col gap-1.5 border-border p-4 text-left transition-colors duration-150 ease-out [&:not(:first-child)]:border-l'
const PRESSABLE =
  'cursor-pointer hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

/** Stat card (Figma "Stat card"): default, hover, and active when it filters the list below. */
export default function StatTile({
  label,
  value,
  trend,
  trendNote,
  invert = false,
  note,
  onSelect,
  active = false,
  variant = 'card',
  className,
}: StatTileProps) {
  // Render logic
  const strip = variant === 'strip'
  const up = (trend ?? 0) > 0
  const good = invert ? !up : up
  const body = (
    <>
      <span
        className={
          strip
            ? 'text-[0.8125rem] leading-[1.1875rem] text-muted-foreground'
            : 'text-caption text-muted-foreground'
        }
      >
        {label}
      </span>
      <span
        className={
          strip
            ? 'text-[1.75rem] leading-[2.125rem] font-semibold tracking-[-0.02em] text-ink-strong tabular-nums'
            : 'text-stat text-ink-strong tabular-nums'
        }
      >
        {value}
      </span>
      {trend ? (
        <span
          className={cn(
            'inline-flex items-center gap-1 font-medium',
            strip ? 'text-xs' : 'text-caption',
            strip
              ? good
                ? 'text-foreground'
                : 'text-danger'
              : good
                ? 'text-success'
                : 'text-danger',
          )}
        >
          {up ? (
            <ArrowUp className="size-3" aria-hidden />
          ) : (
            <ArrowDown className="size-3" aria-hidden />
          )}
          {Math.abs(trend)}%
          {trendNote ? (
            <span className="font-normal text-muted-foreground">{trendNote}</span>
          ) : null}
        </span>
      ) : note || trendNote ? (
        <span className={cn('text-muted-foreground', strip ? 'text-xs' : 'text-caption')}>
          {note ?? trendNote}
        </span>
      ) : null}
    </>
  )

  if (!onSelect) return <div className={cn(strip ? STRIP : BASE, className)}>{body}</div>

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={cn(
        strip ? STRIP : BASE,
        strip
          ? 'cursor-pointer hover:bg-row-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset'
          : PRESSABLE,
        active &&
          (strip
            ? 'bg-primary-soft hover:bg-primary-soft'
            : 'bg-brand-select bg-none shadow-[inset_0_0_0_1px_var(--primary)]'),
        className,
      )}
    >
      {body}
    </button>
  )
}
