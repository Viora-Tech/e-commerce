import type { DashboardSummary } from '@commerce/api'
import Link from 'next/link'
import RelativeTime from '@/components/layout/relative-time'
import SectionHead from '@/components/layout/section-head'
import { homePageContent } from '@/data/home'
import { getCopy, getLocale } from '@/lib/copy-server'
import { formatters } from '@/lib/format'
import { initials } from '@/lib/initials'
import { routes } from '@/lib/routes'

type LatestOrdersProps = {
  orders: DashboardSummary['recentOrders']
}

type Order = LatestOrdersProps['orders'][number]
type Tone = 'neutral' | 'attention' | 'info' | 'violet' | 'success' | 'danger'

const ROWS = 5
const SHIPPED = new Set(['shipped', 'fulfilled', 'partially_fulfilled', 'partially_delivered'])

/** Figma Badge (536:484): soft tint, hairline in the same hue, a dot, 12/16 medium. */
const TONE: Record<Tone, string> = {
  neutral: 'border-neutral-border bg-neutral-soft text-muted-foreground',
  attention: 'border-warning-border bg-warning-soft text-warning',
  info: 'border-info-border bg-info-soft text-info',
  violet: 'border-violet-border bg-violet-soft text-violet',
  success: 'border-success-border bg-success-soft text-success',
  danger: 'border-danger-border bg-danger-soft text-danger',
}

/** The status badge, one hue per state as in the Figma list (cancelled and other ends stay grey). */
function chipFor(
  order: Order,
  c: (typeof homePageContent)['latest'],
): { label: string; tone: Tone } {
  if (order.status === 'cancelled') return { label: c.cancelled, tone: 'neutral' }
  if (order.paymentStatus === 'refund_needed') return { label: c.refund, tone: 'danger' }
  if (order.fulfillmentStatus === 'delivered') return { label: c.delivered, tone: 'success' }
  if (SHIPPED.has(order.fulfillmentStatus)) return { label: c.shipped, tone: 'violet' }
  if (order.paymentStatus === 'paid') return { label: c.toShip, tone: 'info' }
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
      <div className="flex-1 rounded-lg surface-card">
        {rows.length === 0 ? (
          <p className="p-5 text-body text-muted-foreground">{c.empty}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {rows.map((order) => {
              const name = order.customerName ?? order.email ?? `#${order.number}`
              const chip = chipFor(order, c)
              const detail = routes.orders.detail(order.id)
              return (
                <li
                  key={order.id}
                  className="group flex items-center gap-3.5 px-5 py-3.5 transition-colors duration-300 ease-out first:rounded-t-lg last:rounded-b-lg hover:bg-row-hover"
                >
                  <Link
                    href={detail}
                    className="flex min-w-0 flex-1 items-center gap-3.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span
                      className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-foreground"
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
                    <span className="transition-opacity duration-300 ease-out group-focus-within:opacity-0 group-hover:opacity-0">
                      <span
                        className={`inline-flex items-center gap-1 rounded-[0.375rem] border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${TONE[chip.tone]}`}
                      >
                        <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
                        {chip.label}
                      </span>
                    </span>
                    {/* Figma "Home · Polished" row actions (hover): two small buttons take the chip's
                        place on the row itself, no panel behind them. */}
                    <span className="pointer-events-none absolute inset-0 flex items-center justify-center gap-1.5 opacity-0 transition-opacity duration-300 ease-out group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100">
                      {canShip(order) ? (
                        <Link
                          href={detail}
                          className="rounded-[0.4375rem] bg-primary px-2.5 py-1.25 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {c.ship}
                        </Link>
                      ) : null}
                      <Link
                        href={detail}
                        className="rounded-[0.4375rem] border border-border px-2.5 py-1.25 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
