import type { OverviewChannel } from '@commerce/api'
import Link from 'next/link'
import type { MouseEvent } from 'react'
import CustomerAvatar from '@/components/customers/customer-avatar'
import StatusChip from '@/components/layout/status-chip'
import OrderChip from '@/components/orders/order-chip'
import OrderLinesPopover from '@/components/orders/order-lines-popover'
import { orderStage } from '@/components/orders/order-stage'
import ProductThumb from '@/components/products/product-thumb'
import type { ResourceColumnSpec } from '@/components/table/resource-table'
import { CHANNEL_LABELS } from '@/data/growth'
import { ordersContent } from '@/data/orders'
import { useCopy } from '@/hooks/use-copy'
import type { api } from '@/lib/api-client'
import type { Formatters } from '@/lib/format'
import { routes } from '@/lib/routes'

type Item = Awaited<ReturnType<typeof api.orders.list>>['items'][number]

/* A link inside a row: the row's own click (which navigates) must not also run. Ctrl/Cmd-click
   then opens a new tab only, and a plain click is handled by the link alone. */
function stopRowClick(e: MouseEvent) {
  e.stopPropagation()
}

/** A tracking link typed by hand is linked only when it is a web address. */
function webUrl(url: string | null): string | null {
  return url && /^https?:\/\//i.test(url) ? url : null
}

/* Figma "Table / Cell · Avatar": a 24px muted initials disc, the customer's name 14/20 medium
   and their email 12/16 muted beneath (owner: a Customer column of its own). */
function CustomerCell({ item }: { item: Item }) {
  // Hooks
  const copy = useCopy(ordersContent)

  // Render logic
  const who = item.customerName ?? item.email ?? copy.guest
  return (
    <span className="flex items-center gap-3 text-left">
      <CustomerAvatar
        name={item.customerName}
        email={item.email}
        className="size-6 bg-muted font-medium text-foreground"
      />
      <span className="min-w-0">
        <span className="line-clamp-1 text-body font-medium text-ink-strong">{who}</span>
        {item.customerName && item.email ? (
          <span className="line-clamp-1 text-xs text-muted-foreground">{item.email}</span>
        ) : null}
      </span>
    </span>
  )
}

/* Figma "Table / Cell · Thumb": a 32px radius-6 muted thumb on a border, the first line title
   13/19 and a muted 12/16 "+n more" under it. */
function ProductCell({ item }: { item: Item }) {
  // Hooks
  const copy = useCopy(ordersContent)

  // Render logic
  const extra = item.lineCount - 1
  return (
    <span className="flex items-center gap-3 text-left">
      {/* No picture, or one that fails to load, shows the image icon (Figma Thumb cell). */}
      <ProductThumb url={item.firstLineImage} className="rounded-[0.375rem]" />
      <span className="min-w-0">
        <span className="line-clamp-1 text-[0.8125rem] leading-[1.1875rem] text-foreground">
          {item.firstLineTitle ?? copy.guest}
        </span>
        {extra > 0 ? (
          <span className="block">
            <OrderLinesPopover
              orderId={item.id}
              lineCount={item.lineCount}
              label={copy.moreLines(extra)}
            />
          </span>
        ) : null}
      </span>
    </span>
  )
}

/** The Orders list's columns (Figma "Orders · List", "State · Columns open"). */
export function orderColumns(
  copy: typeof ordersContent,
  fmt: Formatters,
): ResourceColumnSpec<Item>[] {
  return [
    {
      id: 'number',
      title: copy.columns.order,
      sortValue: (o) => o.number,
      sortTitle: copy.sortTitles.order,
      sortRank: 1,
      hideable: false,
      className: 'w-[9%]',
      render: (o) => (
        <span className="inline-flex items-center gap-1.5">
          {/* Cancelled reads as gone at a glance, like Shopify's struck-through rows (audit #6). */}
          {/* A real link (#1008): middle-click and Ctrl-click open the order in a new tab. */}
          <Link
            href={routes.orders.detail(o.id)}
            onClick={stopRowClick}
            className={
              o.status === 'cancelled'
                ? 'rounded-sm text-body font-medium text-muted-foreground line-through tabular-nums hover:underline'
                : 'rounded-sm text-body font-medium text-ink-strong tabular-nums hover:underline'
            }
          >
            #{o.number}
          </Link>
          {o.archivedAt ? <StatusChip>{copy.archivedChip}</StatusChip> : null}
          {o.isTest ? (
            <span title={copy.testChipHint}>
              <StatusChip tone="attention">{copy.testChip}</StatusChip>
            </span>
          ) : null}
        </span>
      ),
    },
    {
      id: 'customer',
      title: copy.columns.customer,
      sortValue: (o) => (o.customerName ?? o.email ?? '').toLowerCase(),
      sortTitle: copy.sortTitles.customer,
      sortRank: 3,
      className: 'w-[20%] whitespace-normal',
      render: (o) => <CustomerCell item={o} />,
    },
    {
      id: 'product',
      title: copy.columns.product,
      className: 'w-[20%] whitespace-normal',
      render: (o) => <ProductCell item={o} />,
    },
    {
      id: 'date',
      title: copy.columns.date,
      sortValue: (o) => new Date(o.placedAt).getTime(),
      sortLabels: { desc: copy.sortNewest, asc: copy.sortOldest },
      sortRank: 0,
      render: (o) => (
        <span className="text-[0.8125rem] text-muted-foreground tabular-nums">
          {fmt.when(o.placedAt)}
        </span>
      ),
    },
    {
      id: 'total',
      title: copy.columns.total,
      sortValue: (o) => o.totalPaise,
      sortRank: 2,
      align: 'end',
      render: (o) => (
        <span
          className={
            o.status === 'cancelled'
              ? 'font-medium text-muted-foreground line-through tabular-nums'
              : 'font-medium tabular-nums'
          }
        >
          {fmt.money(o.totalPaise)}
        </span>
      ),
    },
    {
      id: 'payment',
      title: copy.columns.payment,
      sortValue: (o) => o.paymentStatus,
      sortTitle: copy.sortTitles.payment,
      sortRank: 4,
      align: 'center',
      render: (o) => <OrderChip kind="orderPayment" value={o.paymentStatus} />,
    },
    {
      id: 'fulfilment',
      title: copy.columns.fulfilment,
      sortValue: (o) => o.fulfillmentStatus,
      sortTitle: copy.sortTitles.fulfilment,
      sortRank: 5,
      align: 'center',
      render: (o) => <OrderChip kind="fulfilment" value={o.fulfillmentStatus} />,
    },
    {
      id: 'status',
      title: copy.columns.status,
      align: 'center',
      render: (o) => {
        if (
          o.status === 'open' &&
          o.fulfillmentStatus === 'unfulfilled' &&
          o.paymentStatus === 'paid'
        )
          return <StatusChip tone="info">{copy.toShip}</StatusChip>
        const stage = orderStage(o)
        return <OrderChip kind={stage.kind} value={stage.value} />
      },
    },
    {
      id: 'channel',
      title: copy.columns.channel,
      className: 'w-[9%]',
      render: (o) => (
        <span className="block truncate text-[0.8125rem] text-muted-foreground">
          {CHANNEL_LABELS[o.channel as OverviewChannel] ?? CHANNEL_LABELS.untracked}
        </span>
      ),
    },
    {
      id: 'tags',
      title: copy.columns.tags,
      className: 'w-[12%] whitespace-normal',
      render: (o) =>
        o.tags.length ? (
          // A long tag ("Essential Preorder") is cut with "…" inside the column instead of
          // running into Delivery; hover shows it whole.
          <span className="flex min-w-0 flex-wrap gap-1">
            {o.tags.slice(0, 2).map((t) => (
              <StatusChip key={t} className="max-w-full min-w-0">
                <span className="truncate" title={t}>
                  {t}
                </span>
              </StatusChip>
            ))}
            {o.tags.length > 2 ? (
              <span className="text-xs text-muted-foreground">+{o.tags.length - 2}</span>
            ) : null}
          </span>
        ) : null,
    },
    {
      id: 'items',
      title: copy.columns.items,
      sortValue: (o) => o.itemCount,
      align: 'end',
      render: (o) => <span className="tabular-nums">{fmt.number(o.itemCount)}</span>,
    },
    {
      id: 'delivery',
      title: copy.columns.delivery,
      sortValue: (o) => o.deliveryStatus ?? '',
      render: (o) =>
        o.deliveryStatus ? (
          webUrl(o.trackingUrl) ? (
            // The courier's tracking page, in a new tab (#1008); middle-click works too.
            <a
              href={webUrl(o.trackingUrl) ?? undefined}
              target="_blank"
              rel="noopener noreferrer"
              title={copy.trackDelivery}
              aria-label={copy.trackDelivery}
              onClick={stopRowClick}
              className="inline-flex rounded-full hover:opacity-80"
            >
              <OrderChip kind="shipment" value={o.deliveryStatus} />
            </a>
          ) : (
            <OrderChip kind="shipment" value={o.deliveryStatus} />
          )
        ) : (
          // Fulfilled by hand (no courier booking) is not "not shipped": it went, untracked.
          <span className="text-muted-foreground">
            {o.fulfillmentStatus === 'unfulfilled' ? copy.noDelivery : copy.noTracking}
          </span>
        ),
    },
    {
      id: 'phone',
      title: copy.columns.phone,
      render: (o) => <span className="tabular-nums">{o.shipPhone ?? ''}</span>,
    },
    {
      id: 'city',
      title: copy.columns.city,
      sortValue: (o) => (o.shipCity ?? '').toLowerCase(),
      render: (o) => o.shipCity ?? '',
    },
  ]
}
