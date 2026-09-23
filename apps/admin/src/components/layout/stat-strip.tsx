import { cn } from '@commerce/ui/lib/utils'
import { Card } from '@commerce/ui/shadcn/card'
import CountUp from './count-up'
import DeltaChip from './delta-chip'

export type StripStat = {
  label: string
  value: string
  /** Muted line under the figure: the period or a short note. */
  hint?: string
  /** Percent change against the previous period; sign decides colour. */
  delta?: number | null
  /** Set when a rise is bad news (cancellations) so the colours flip. */
  invert?: boolean
  /** `critical` draws the figure in the destructive colour (out of stock). */
  tone?: 'default' | 'critical'
}

type StatStripProps = {
  stats: StripStat[]
  className?: string
}

/**
 * The summary above a list: one hairline card split into equal cells, 12px muted label,
 * 20/500 figure and a muted hint. Lighter than a row of KPI cards, in the Saleor spirit
 * of keeping list pages about the list.
 */
export default function StatStrip({ stats, className }: StatStripProps) {
  return (
    <Card className={cn('gap-0 py-0', className)}>
      <dl className="grid grid-cols-2 gap-px bg-border xl:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="flex min-w-0 flex-col gap-1 bg-card px-4 py-3">
            <dt className="truncate text-caption text-muted-foreground">{s.label}</dt>
            <dd className="flex items-baseline gap-2">
              <span
                className={cn(
                  'text-stat font-medium tabular-nums',
                  s.tone === 'critical' ? 'text-destructive' : 'text-ink-strong',
                )}
              >
                <CountUp value={s.value} />
              </span>
              <DeltaChip delta={s.delta} invert={s.invert} />
            </dd>
            {s.hint ? (
              <dd className="truncate text-caption font-normal text-muted-foreground">{s.hint}</dd>
            ) : null}
          </div>
        ))}
      </dl>
    </Card>
  )
}
