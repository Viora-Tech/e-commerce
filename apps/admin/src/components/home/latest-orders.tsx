import type { DashboardSummary } from '@commerce/api'
import Link from 'next/link'
import RelativeTime from '@/components/layout/relative-time'
import StatusChip from '@/components/layout/status-chip'
import { homePageContent } from '@/data/home'
import { getCopy, getLocale } from '@/lib/copy-server'
import { formatters } from '@/lib/format'
import { routes } from '@/lib/routes'
import SectionHead from './section-head'

type LatestOrdersProps = {
  orders: DashboardSummary['recentOrders']
}

type Order = LatestOrdersProps['orders'][number]
type Tone = 'neutral' | 'attention' | 'info' | 'danger'

const ROWS = 5
const SHIPPED = new Set(['shipped', 'fulfilled', 'partially_fulfilled', 'partially_delivered'])

/** Up to two capitals for the round avatar: "Riya Sharma" is RS, an email gives its first letter. */
function initials(name: string): string {
  const words = name
    .replace(/^#/, '')
    .split(/[\s@._-]+/)
    .filter(Boolean)
  return words
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase()
}

/** The status chip: coloured only where the owner has something to do, grey once it is done. */
function chipFor(
  order: Order,
  c: (typeof homePageContent)['latest'],
): { label: string; tone: Tone } {
  if (order.status === 'cancelled') return { label: c.cancelled, tone: 'neutral' }
  if (order.paymentStatus === 'refund_needed') return { label: c.refund, tone: 'danger' }
  if (order.fulfillmentStatus === 'delivered') return { label: c.delivered, tone: 'neutral' }
  if (SHIPPED.has(order.fulfillmentStatus)) return { label: c.shipped, tone: 'info' }
  if (order.paymentStatus === 'paid') return { label: c.toShip, tone: 'attention' }
  if (order.paymentStatus === 'unpaid' || order.paymentStatus === 'authorized') {
    return { label: c.paymentDue, tone: 'attention' }
  }
  return { label: c.done, tone: 'neutral' }
}

/** The five newest orders: who, when, a soft status chip and the amount. */
export default async function LatestOrders({ orders }: LatestOrdersProps) {
  // Render logic
  const c = (await getCopy(homePageContent)).latest
  const fmt = formatters(await getLocale())
  const rows = orders.slice(0, ROWS)

  return (
    <section className="flex min-w-0 flex-col gap-3">
      <SectionHead
        title={c.title}
        aside={
          <Link href={routes.orders.list()} className="hover:text-foreground hover:underline">
            {c.viewAll}
          </Link>
        }
      />
      <div className="flex-1 rounded-2xl surface-card">
        {rows.length === 0 ? (
          <p className="p-5 text-body text-muted-foreground">{c.empty}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-hairline">
            {rows.map((order) => {
              const name = order.customerName ?? order.email ?? `#${order.number}`
              const chip = chipFor(order, c)
              return (
                <li key={order.id}>
                  <Link
                    href={routes.orders.detail(order.id)}
                    className="flex items-center gap-3 px-4 py-3 transition-colors first:rounded-t-2xl last:rounded-b-2xl hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span
                      className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-caption text-muted-foreground"
                      aria-hidden="true"
                    >
                      {initials(name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body-strong text-ink-strong">
                        {name}
                      </span>
                      <span className="block truncate text-caption font-normal text-muted-foreground">
                        #{order.number} · <RelativeTime value={order.placedAt} />
                      </span>
                    </span>
                    <StatusChip tone={chip.tone}>{chip.label}</StatusChip>
                    <span className="w-20 shrink-0 text-right text-body-strong text-ink-strong tabular-nums">
                      {fmt.money(order.totalPaise)}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}
