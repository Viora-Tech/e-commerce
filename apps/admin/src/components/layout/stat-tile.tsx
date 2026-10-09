import { ArrowDown, ArrowUp } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'

type StatTileProps = {
  label: string
  /** Already formatted (money, count). */
  value: string
  /** Percent change against the previous period; the sign picks the arrow. */
  trend?: number | null
  /** A plain line under the figure when there is no trend, e.g. "Awaiting the transfer". */
  note?: string
  /** Text after the arrow, e.g. "vs yesterday". */
  trendNote?: string
  /** A rise is bad news (cancellations): the colours flip. */
  invert?: boolean
  /** Makes the tile a filter button; `active` marks the current one. */
  onSelect?: () => void
  active?: boolean
  className?: string
}

const BASE =
  'flex flex-col gap-1 rounded-lg bg-card p-4 text-left shadow-card transition-[box-shadow,background-color] duration-150 ease-out'
const PRESSABLE =
  'cursor-pointer hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'

/** Stat card (Figma "Stat card"): default, hover, and active when it filters the list below. */
export default function StatTile({
  label,
  value,
  trend,
  trendNote,
  note,
  invert = false,
  onSelect,
  active = false,
  className,
}: StatTileProps) {
  // Render logic
  const up = (trend ?? 0) > 0
  const good = invert ? !up : up
  const body = (
    <>
      <span className="text-caption text-muted-foreground">{label}</span>
      <span className="text-stat text-ink-strong tabular-nums">{value}</span>
      {note && !trend ? <span className="text-caption text-muted-foreground">{note}</span> : null}
      {trend ? (
        <span
          className={cn(
            'inline-flex items-center gap-1 text-caption font-medium',
            good ? 'text-success' : 'text-danger',
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
      ) : null}
    </>
  )

  if (!onSelect) return <div className={cn(BASE, className)}>{body}</div>

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={cn(
        BASE,
        PRESSABLE,
        active && 'bg-primary-soft shadow-[inset_0_0_0_1px_var(--primary)]',
        className,
      )}
    >
      {body}
    </button>
  )
}
