'use client'

import { Card } from '@commerce/ui/shadcn/card'
import CardMenu from '@/components/layout/card-menu'
import DetailsLink from '@/components/layout/details-link'
import MiniBars from '@/components/layout/mini-bars'
import { homeContent } from '@/data/home'
import { INDIAN_STATES } from '@/data/india'
import { formatCompact, formatPaiseCompact } from '@/lib/money'

type StateRow = { stateCode: string; revenuePaise: number; orders: number; share: number }

type ActivityCardProps = {
  ordersLast24h: number
  perHour: number[]
  salesByState: StateRow[]
}

function stateName(code: string): string {
  return INDIAN_STATES.find((s) => s.code === code)?.name ?? code
}

/** Two-letter badge standing in for the kit's flag (5:1671). */
function StateBadge({ code }: { code: string }) {
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-bold text-primary">
      {code}
    </span>
  )
}

/**
 * Frame 5:1618 (361 x 460): headline count with a 32px figure, the "per minute"
 * bar strip 35px tall, then "Sales by Country" rows (28px flag, value, name,
 * progress bar, delta) and a full-width outline pill at the bottom. Ours shows
 * orders per hour and sales by Indian state; no map, no geo delta.
 */
export default function ActivityCard({ ordersLast24h, perHour, salesByState }: ActivityCardProps) {
  const c = homeContent.activity
  const bars = perHour.map((value, i) => ({ label: String(i), value }))

  return (
    <Card className="relative h-[28.75rem] gap-0 p-5 pb-16">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-kit-body text-link">{c.title}</p>
          <p className="mt-1 text-kit-stat text-ink-strong tabular-nums">
            {formatCompact(ordersLast24h)}
          </p>
        </div>
        <CardMenu items={[{ label: homeContent.menu.viewOrders, href: '/orders' }]} />
      </div>
      <p className="mt-5 text-kit-body text-muted-foreground">{c.perHour}</p>
      <MiniBars data={bars} className="mt-3" />

      <div className="mt-6 flex items-center justify-between">
        <p className="text-kit-title text-foreground">{c.byState}</p>
        <p className="text-kit-title text-foreground">{c.sales}</p>
      </div>
      {salesByState.length === 0 ? (
        <p className="mt-4 text-kit-body text-muted-foreground">{c.empty}</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-6">
          {salesByState.map((row) => (
            <li key={row.stateCode} className="flex items-center gap-3">
              <StateBadge code={row.stateCode} />
              <span className="w-24 shrink-0">
                <span className="block text-kit-cell font-bold text-ink-strong tabular-nums">
                  {formatPaiseCompact(row.revenuePaise)}
                </span>
                <span className="block truncate text-kit-body text-muted-foreground">
                  {stateName(row.stateCode)}
                </span>
              </span>
              <span className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-secondary">
                <span
                  className="block h-full rounded-full bg-link"
                  style={{ width: `${Math.max(4, Math.round(row.share * 100))}%` }}
                />
              </span>
              <span className="w-16 shrink-0 whitespace-nowrap text-right text-kit-body text-muted-foreground tabular-nums">
                {c.ordersCount(row.orders)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="absolute inset-x-5 bottom-5 flex">
        <DetailsLink href="/analytics" label={c.insight} />
      </div>
    </Card>
  )
}
