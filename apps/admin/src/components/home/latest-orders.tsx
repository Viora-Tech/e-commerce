import type { DashboardSummary } from '@commerce/api'
import { cn } from '@commerce/ui/lib/utils'
import { buttonVariants } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import DataCard from '@/components/layout/data-card'
import EmptyState from '@/components/layout/empty-state'
import RelativeTime from '@/components/layout/relative-time'
import StatusChip from '@/components/layout/status-chip'
import type { ChipTone } from '@/components/status/tone'
import { homePageContent } from '@/data/home'
import { getCopy, getLocale } from '@/lib/copy-server'
import { formatters } from '@/lib/format'
import { initials } from '@/lib/initials'
import { routes } from '@/lib/routes'
import { LATEST_ROWS, ORDER_ROW } from './home-layout'

type LatestOrdersProps = {
  orders: DashboardSummary['recentOrders']
}

type Order = LatestOrdersProps['orders'][number]

const SHIPPED = new Set(['shipped', 'fulfilled', 'partially_fulfilled', 'partially_delivered'])

/** The status badge, one hue per state as in the Figma list (cancelled and other ends stay grey). */
function chipFor(
  order: Order,
  c: (typeof homePageContent)['latest'],
): { label: string; tone: ChipTone } {
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
  const rows = orders.slice(0, LATEST_ROWS)

  return (
    <DataCard
      title={c.title}
      action={
        <Link
          href={routes.orders.list()}
          className="text-body text-muted-foreground hover:text-foreground hover:underline"
        >
          {c.viewAll}
        </Link>
      }
      flush={rows.length > 0}
      /* The rows run to the card's bottom edge; the card clips their hover at its corners. */
      className={cn('min-w-0', rows.length > 0 && 'pb-0')}
    >
      {rows.length === 0 ? (
        <EmptyState variant="inline" body={c.empty} />
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {rows.map((order) => {
            const name = order.customerName ?? order.email ?? `#${order.number}`
            const chip = chipFor(order, c)
            const detail = routes.orders.detail(order.id)
            return (
              <li
                key={order.id}
                className={cn(
                  ORDER_ROW,
                  'group transition-colors duration-300 ease-out hover:bg-row-hover',
                )}
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
                    <span className="block truncate text-body-strong text-ink-strong">{name}</span>
                    <span className="block truncate text-caption font-normal leading-[1.1875rem] text-muted-foreground">
                      #{order.number} · <RelativeTime value={order.placedAt} />
                    </span>
                  </span>
                </Link>
                {/* A fixed slot so every chip sits centred on the same line, whatever its length. */}
                <span className="relative flex w-28 shrink-0 justify-center">
                  <span className="transition-opacity duration-300 ease-out group-focus-within:opacity-0 group-hover:opacity-0">
                    <StatusChip tone={chip.tone}>{chip.label}</StatusChip>
                  </span>
                  {/* Figma "Home · Polished" row actions (hover): two small buttons take the chip's
                        place on the row itself, no panel behind them. */}
                  <span className="pointer-events-none absolute inset-0 flex items-center justify-center gap-1.5 opacity-0 transition-opacity duration-300 ease-out group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100">
                    {canShip(order) ? (
                      <Link href={detail} className={buttonVariants({ size: 'xs' })}>
                        {c.ship}
                      </Link>
                    ) : null}
                    <Link
                      href={detail}
                      className={buttonVariants({ variant: 'outline', size: 'xs' })}
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
    </DataCard>
  )
}
