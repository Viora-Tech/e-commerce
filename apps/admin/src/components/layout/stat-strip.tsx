import { cn } from '@commerce/ui/lib/utils'
import StatTile from '@/components/layout/stat-tile'

export type StatStripTile<T extends string> = {
  id: string
  label: string
  /** Already formatted (money, count). */
  value: string
  /** Percent change against the previous period; the sign picks the arrow. */
  trend?: number | null
  /** Text after the arrow, e.g. "vs yesterday"; on its own (no trend) it is a plain note line. */
  trendNote?: string
  /** A plain line under the figure when there is no trend. */
  note?: string
  /** A rise is bad news (cancellations): the colours flip. */
  invert?: boolean
  /** A small trend line beside the figure. */
  spark?: number[] | undefined
  /** Makes the tile a filter: pressing it picks this value, `null` is the "all" tile. */
  filter?: T | null
}

type StatStripProps<T extends string> = {
  /** `strip`: one card with dividers (Figma "Stat strip"); `card`: separate stat cards. */
  variant?: 'card' | 'strip'
  tiles: StatStripTile<T>[]
  /** The filter now showing; the tile that matches it lights up, `null` is "all". */
  active?: T | null
  /** Called with the picked filter, or `null` when the active tile is pressed again. */
  onChange?: (filter: T | null) => void
  loading?: boolean
  /** `3`: a fixed three-column grid (Analytics KPIs, two rows of three). Default: one row. */
  columns?: 3
}

const LAYOUT = 'grid grid-cols-2 lg:grid-flow-col lg:grid-cols-none lg:auto-cols-fr'
const THREE = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'

/** A row of stat tiles that owns the grid and the press-again-to-clear filter toggle. */
export default function StatStrip<T extends string>({
  variant = 'card',
  tiles,
  active = null,
  onChange,
  loading,
  columns,
}: StatStripProps<T>) {
  // Event handlers
  const handlePick = (filter: T | null) =>
    onChange?.(filter !== null && active === filter ? null : filter)

  // Render logic
  const strip = variant === 'strip'

  return (
    <div
      className={cn(
        columns === 3 ? THREE : LAYOUT,
        strip ? 'overflow-hidden rounded-lg surface-card' : 'gap-4',
      )}
      aria-busy={loading || undefined}
    >
      {tiles.map((tile) => {
        const filter = tile.filter
        const pickable = onChange !== undefined && filter !== undefined
        return (
          <StatTile
            key={tile.id}
            variant={variant}
            label={tile.label}
            value={tile.value}
            trend={tile.trend}
            trendNote={tile.trendNote}
            note={tile.note}
            invert={tile.invert}
            spark={tile.spark}
            active={pickable && active === filter}
            onSelect={pickable ? () => handlePick(filter) : undefined}
          />
        )
      })}
    </div>
  )
}
