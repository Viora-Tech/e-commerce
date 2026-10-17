import { Card } from '@commerce/ui/shadcn/card'
import type { ReactNode } from 'react'
import KitProgress from '@/components/kit/kit-progress'
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
    <Card gap="none" inset={5}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-kit-title text-foreground">{title}</p>
        {action}
      </div>
      {rows.length === 0 ? (
        <p className="mt-5 text-kit-body text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-5 flex flex-col gap-4">
          {rows.map((row) => (
            <li key={row.key} className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-3">
                <span
                  className="min-w-0 truncate text-kit-body font-medium text-foreground"
                  title={row.label}
                >
                  {row.label}
                </span>
                <span className="shrink-0 text-kit-body text-ink-strong tabular-nums">
                  {formatCompact(row.count)}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <KitProgress value={Math.max(0.02, row.share)} className="min-w-0 flex-1" />
                <span className="w-12 shrink-0 text-right text-kit-mini text-muted-foreground tabular-nums">
                  {formatRate(row.share)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
