import { Card } from '@commerce/ui/shadcn/card'
import KitProgress from '@/components/kit/kit-progress'
import { formatRate } from '@/lib/analytics-range'
import { formatPaiseWhole } from '@/lib/money'

export type BreakdownRow = {
  key: string
  label: string
  meta?: string | undefined
  revenuePaise: number
  share: number
}

type BreakdownCardProps = {
  title: string
  rows: BreakdownRow[]
  empty: string
}

/** A ranked list with a share bar: sales by state, payment methods, channels. */
export default function BreakdownCard({ title, rows, empty }: BreakdownCardProps) {
  // Render logic
  return (
    <Card gap="none" inset={5}>
      <p className="text-kit-title text-foreground">{title}</p>
      {rows.length === 0 ? (
        <p className="mt-5 text-kit-body text-muted-foreground">{empty}</p>
      ) : (
        <ul className="mt-5 flex flex-col gap-4">
          {rows.map((row) => (
            <li key={row.key} className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-kit-body font-medium text-foreground">
                  {row.label}
                  {row.meta ? (
                    <span className="ml-2 text-kit-mini text-muted-foreground-soft">
                      {row.meta}
                    </span>
                  ) : null}
                </span>
                <span className="shrink-0 text-kit-body text-ink-strong tabular-nums">
                  {formatPaiseWhole(row.revenuePaise)}
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
