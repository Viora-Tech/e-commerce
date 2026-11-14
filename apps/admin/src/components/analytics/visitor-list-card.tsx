import type { ReactNode } from 'react'
import KitProgress from '@/components/kit/kit-progress'
import DataCard from '@/components/layout/data-card'
import EmptyState from '@/components/layout/empty-state'
import { formatRate } from '@/lib/analytics-range'
import { formatCompact } from '@/lib/money'

export type VisitorListRow = { key: string; label: string; count: number; share: number }

type VisitorListCardProps = {
  title: string
  rows: VisitorListRow[]
  empty: string
  /** Right of the title, e.g. a "See all" link. */
  action?: ReactNode
}

/** A ranked visitor list from Umami (top pages, referrers, countries…): count and share bar. */
export default function VisitorListCard({ title, rows, empty, action }: VisitorListCardProps) {
  // Render logic
  return (
    <DataCard title={title} action={action}>
      {rows.length === 0 ? (
        <EmptyState variant="inline" body={empty} />
      ) : (
        <ul className="flex flex-col gap-4">
          {rows.map((row) => (
            <li key={row.key} className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-3">
                <span
                  className="min-w-0 truncate text-body font-medium text-foreground"
                  title={row.label}
                >
                  {row.label}
                </span>
                <span className="shrink-0 text-body text-ink-strong tabular-nums">
                  {formatCompact(row.count)}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <KitProgress value={Math.max(0.02, row.share)} className="min-w-0 flex-1" />
                <span className="w-12 shrink-0 text-right text-period text-muted-foreground tabular-nums">
                  {formatRate(row.share)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </DataCard>
  )
}
