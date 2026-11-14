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
  tiles: StatStripTile<T>[]
  /** The filter now showing; the tile that matches it lights up, `null` is "all". */
  active?: T | null
  /** Called with the picked filter, or `null` when the active tile is pressed again. */
  onChange?: (filter: T | null) => void
  /** The figures are loading: every cell draws grey bars in place of its figures (same height). */
  loading?: boolean
  /**
   * With no `tiles` yet (a route's loading screen): how many placeholder cells to draw while
   * `loading`, so the strip is as tall and as wide as the loaded one.
   */
  placeholders?: number
  /** `3`: a fixed three-column grid (Analytics KPIs, two rows of three). Default: one row. */
  columns?: 3
}

const STRIP =
  'grid gap-px overflow-hidden rounded-lg border border-border bg-border shadow-[var(--shadow-card)]'
const LAYOUT = 'grid-cols-2 lg:grid-flow-col lg:grid-cols-none lg:auto-cols-fr'
const THREE = 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'

/**
 * Figma "Stat strip": the one stat row every list and overview page opens with. One card, the
 * cells joined by hairlines (a 1px gap over the border colour, so wrapped rows on a phone keep
 * their lines too), owning the press-again-to-clear filter toggle.
 */
export default function StatStrip<T extends string>({
  tiles,
  active = null,
  onChange,
  loading = false,
  placeholders = 0,
  columns,
}: StatStripProps<T>) {
  // Event handlers
  const handlePick = (filter: T | null) =>
    onChange?.(filter !== null && active === filter ? null : filter)

  // Render logic
  const cells: StatStripTile<T>[] =
    loading && tiles.length === 0
      ? Array.from({ length: placeholders }, (_, i) => ({
          id: `placeholder-${i.toString()}`,
          label: '',
          value: '',
        }))
      : tiles

  return (
    <div className={cn(STRIP, columns === 3 ? THREE : LAYOUT)} aria-busy={loading || undefined}>
      {cells.map((tile) => {
        const filter = tile.filter
        const pickable = onChange !== undefined && filter !== undefined
        return (
          <StatTile
            key={tile.id}
            className="bg-card bg-[image:var(--card-surface)]"
            label={tile.label}
            value={tile.value}
            trend={tile.trend}
            trendNote={tile.trendNote}
            note={tile.note}
            invert={tile.invert}
            spark={tile.spark}
            loading={loading}
            active={pickable && active === filter}
            onSelect={pickable && !loading ? () => handlePick(filter) : undefined}
          />
        )
      })}
    </div>
  )
}
