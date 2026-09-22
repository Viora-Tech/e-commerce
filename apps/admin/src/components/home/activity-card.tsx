'use client'

import { Card } from '@commerce/ui/shadcn/card'
import KitButton from '@/components/kit/kit-button'
import KitProgress from '@/components/kit/kit-progress'
import CardMenu from '@/components/layout/card-menu'
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

/** Two-letter badge standing in for the kit's 34px flag (14:750). */
function StateBadge({ code }: { code: string }) {
  return (
    <span className="flex size-[2.125rem] shrink-0 items-center justify-center rounded-full bg-primary-soft text-kit-mini font-bold text-primary">
      {code}
    </span>
  )
}

/**
 * Sheet 14:426 (361 x 460, 20px inset): 14px Primary/500 label over a 32/32/700 figure,
 * a 14/500 "per minute" label, the 35px strip of 8px green bars, then an 18/600 "Sales by
 * Country / Sales" row and 34px-flag rows (value 14/600, name 12, 6px Primary progress bar,
 * 10px delta) with a full-width outline pill 16px from the bottom. Ours shows orders per
 * hour and sales by Indian state; no map, order count in place of the geo delta.
 */
export default function ActivityCard({ ordersLast24h, perHour, salesByState }: ActivityCardProps) {
  // Render logic
  const c = homeContent.activity
  const bars = perHour.map((value, i) => ({ label: String(i), value }))

  return (
    <Card className="relative h-[28.75rem] gap-0 p-5 pb-16">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-kit-link text-link">{c.title}</p>
          <p className="mt-1 text-kit-stat-tight text-foreground tabular-nums">
            {formatCompact(ordersLast24h)}
          </p>
        </div>
        <CardMenu items={[{ label: homeContent.menu.viewOrders, href: '/orders' }]} />
      </div>
      <p className="mt-5 text-kit-link font-medium text-muted-foreground">{c.perHour}</p>
      <MiniBars data={bars} className="mt-3" />

      <div className="mt-6 flex items-center justify-between text-kit-title font-semibold text-foreground">
        <p>{c.byState}</p>
        <p>{c.sales}</p>
      </div>
      {salesByState.length === 0 ? (
        <p className="mt-4 text-kit-body text-muted-foreground">{c.empty}</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-6">
          {salesByState.map((row) => (
            <li key={row.stateCode} className="flex items-center gap-3">
              <StateBadge code={row.stateCode} />
              <span className="w-20 shrink-0">
                <span className="block text-kit-body font-semibold text-foreground tabular-nums">
                  {formatPaiseCompact(row.revenuePaise)}
                </span>
                <span className="block truncate text-kit-mini text-muted-foreground-soft">
                  {stateName(row.stateCode)}
                </span>
              </span>
              <KitProgress value={Math.max(0.04, row.share)} className="min-w-0 flex-1" />
              <span className="w-16 shrink-0 whitespace-nowrap text-right text-kit-mini text-muted-foreground tabular-nums">
                {c.ordersCount(row.orders)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <div className="absolute inset-x-4 bottom-4 flex">
        <KitButton variant="pill" href="/analytics" className="w-full text-kit-link">
          {c.insight}
        </KitButton>
      </div>
    </Card>
  )
}
