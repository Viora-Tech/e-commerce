import { formatPercent } from '@commerce/money'
import StatTile from '@/components/layout/stat-tile'
import { type AbandonedListFilter, abandonedContent as copy } from '@/data/drafts'
import { useFormat } from '@/hooks/use-copy'

export type AbandonedStats = {
  carts: number
  valuePaise: number
  recovered: number
  recoveryRate: number
  notRecovered: number
  remindersSent: number
}

type AbandonedTilesProps = {
  stats: AbandonedStats
  /** The tab now showing; the tile that matches it lights up. */
  status: AbandonedListFilter | null
  onSelect: (status: AbandonedListFilter | null) => void
}

/** Four tiles above the table (Figma "Orders / Abandoned checkouts list"); Recovered and Reminders sent filter the table. */
export default function AbandonedTiles({ stats, status, onSelect }: AbandonedTilesProps) {
  // Hooks
  const fmt = useFormat()

  // Event handlers
  const handlePick = (next: AbandonedListFilter) => onSelect(status === next ? null : next)

  return (
    <>
      <StatTile
        variant="strip"
        label={copy.tiles.carts}
        note={copy.tiles.period}
        value={fmt.number(stats.carts)}
        onSelect={() => onSelect(null)}
        active={status === null}
      />
      <StatTile
        variant="strip"
        label={copy.tiles.recovered}
        note={copy.tiles.recoveryRate(formatPercent(stats.recoveryRate))}
        value={fmt.number(stats.recovered)}
        onSelect={() => handlePick('recovered')}
        active={status === 'recovered'}
      />
      <StatTile
        variant="strip"
        label={copy.tiles.value}
        note={copy.tiles.period}
        value={fmt.money(stats.valuePaise)}
      />
      <StatTile
        variant="strip"
        label={copy.tiles.reminders}
        note={copy.tiles.period}
        value={fmt.number(stats.remindersSent)}
        onSelect={() => handlePick('reminder_sent')}
        active={status === 'reminder_sent'}
      />
    </>
  )
}
