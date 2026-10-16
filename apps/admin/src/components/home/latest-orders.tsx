import type { DashboardSummary } from '@commerce/api'
import { buttonVariants } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import RelativeTime from '@/components/layout/relative-time'
import StatusChip from '@/components/layout/status-chip'
import { homePageContent } from '@/data/home'
import { getCopy, getLocale } from '@/lib/copy-server'
import { formatters } from '@/lib/format'
import { initials } from '@/lib/initials'
import { routes } from '@/lib/routes'
import SectionHead from './section-head'

type LatestOrdersProps = {
  orders: DashboardSummary['recentOrders']
}

type Order = LatestOrdersProps['orders'][number]
type Tone = 'neutral' | 'attention' | 'info' | 'danger'

const ROWS = 5
const SHIPPED = new Set(['shipped', 'fulfilled', 'partially_fulfilled', 'partially_delivered'])

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

/** Paid and still packed: the order page (with its fulfil flow) is the next step. */
function canShip(order: Order): boolean {
  return (
    order.status !== 'cancelled' &&
    order.paymentStatus === 'paid' &&
    order.fulfillmentStatus === 'unfulfilled'
  )
}

/** The five newest orders: who, when, a soft status chip and the amount. */
export default async function LatestOrders({ orders }: LatestOrdersProps) {
  // Render logic
  const c = (await getCopy(homePageContent)).latest
  const fmt = formatters(await getLocale())
  const rows = orders.slice(0, ROWS)

  return (
    <section className="flex min-w-0 flex-col gap-3.5">
      <SectionHead
        title={c.title}
        aside={
          <Link href={routes.orders.list()} className="hover:text-foreground hover:underline">
            {c.viewAll}
          </Link>
        }
      />
      <div className="flex-1 rounded-xl surface-card">
        {rows.length === 0 ? (
          <p className="p-5 text-body text-muted-foreground">{c.empty}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-hairline">
            {rows.map((order) => {
              const name = order.customerName ?? order.email ?? `#${order.number}`
              const chip = chipFor(order, c)
              const detail = routes.orders.detail(order.id)
              return (
                <li
                  key={order.id}
                  className="group flex items-center gap-3.5 px-5 py-3.5 transition-colors first:rounded-t-xl last:rounded-b-xl hover:bg-muted/50"
                >
                  <Link
                    href={detail}
                    className="flex min-w-0 flex-1 items-center gap-3.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span
                      className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-caption font-semibold text-muted-foreground"
                      aria-hidden="true"
                    >
                      {initials(order.customerName, order.email ?? String(order.number))}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body-strong text-ink-strong">
                        {name}
                      </span>
                      <span className="block truncate text-[0.8125rem] leading-[1.1875rem] text-muted-foreground">
                        #{order.number} · <RelativeTime value={order.placedAt} />
                      </span>
                    </span>
                  </Link>
                  {/* A fixed slot so every chip sits centred on the same line, whatever its length. */}
                  <span className="relative flex w-28 shrink-0 justify-center">
                    <span className="transition-opacity duration-150 group-focus-within:opacity-0 group-hover:opacity-0">
                      <StatusChip tone={chip.tone}>{chip.label}</StatusChip>
                    </span>
                    <span className="absolute inset-y-[-0.375rem] -right-5 -left-5 hidden items-center justify-center gap-1.5 rounded-md bg-card/95 group-focus-within:flex group-hover:flex">
                      {canShip(order) ? (
                        <Link
                          href={detail}
                          className={buttonVariants({ variant: 'default', size: 'sm' })}
                        >
                          {c.ship}
                        </Link>
                      ) : null}
                      <Link
                        href={detail}
                        className={buttonVariants({ variant: 'outline', size: 'sm' })}
                      >
                        {c.view}
                      </Link>
                    </span>
                  </span>
                  <Link
                    href={detail}
                    aria-label={name}
                    className="w-[5.625rem] shrink-0 text-right text-body font-semibold text-ink-strong tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {fmt.money(order.totalPaise)}
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
