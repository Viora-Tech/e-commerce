import { formatPercent } from '@commerce/money'
import StatStrip from '@/components/layout/stat-strip'
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

  // Render logic
  return (
    <StatStrip
      variant="strip"
      active={status}
      onChange={onSelect}
      tiles={[
        {
          id: 'carts',
          label: copy.tiles.carts,
          note: copy.tiles.period,
          value: fmt.number(stats.carts),
          filter: null,
        },
        {
          id: 'recovered',
          label: copy.tiles.recovered,
          note: copy.tiles.recoveryRate(formatPercent(stats.recoveryRate)),
          value: fmt.number(stats.recovered),
          filter: 'recovered',
        },
        {
          id: 'value',
          label: copy.tiles.value,
          note: copy.tiles.period,
          value: fmt.money(stats.valuePaise),
        },
        {
          id: 'reminders',
          label: copy.tiles.reminders,
          note: copy.tiles.period,
          value: fmt.number(stats.remindersSent),
          filter: 'reminder_sent',
        },
      ]}
    />
  )
}
