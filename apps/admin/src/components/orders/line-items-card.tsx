import { Package } from 'lucide-react'
import { DataCard } from '@/components/layout/data-card'
import { orderDetailContent as copy } from '@/data/orders'
import { formatPaise } from '@/lib/money'
import { type OrderDetail, refundedTotal } from './order-detail-types'

type LineItemsCardProps = {
  order: OrderDetail
}

type TotalRow = { label: string; value: string; strong?: boolean; muted?: boolean }

function totalRows(order: OrderDetail): TotalRow[] {
  const rows: TotalRow[] = [
    { label: copy.items.subtotal, value: formatPaise(order.subtotalPaise) },
    { label: copy.items.shipping, value: formatPaise(order.shippingPaise) },
  ]
  const adj = order.paymentAdjustmentPaise
  if (adj !== 0) {
    rows.push({
      label: order.paymentAdjustmentLabel ?? (adj < 0 ? copy.items.discount : copy.items.fee),
      value: `${adj < 0 ? '−' : '+'}${formatPaise(Math.abs(adj))}`,
    })
  }
  rows.push({ label: copy.items.total, value: formatPaise(order.totalPaise), strong: true })
  const back = refundedTotal(order.refunds)
  if (back > 0) {
    rows.push({ label: copy.items.refunded, value: `−${formatPaise(back)}`, muted: true })
    rows.push({ label: copy.items.net, value: formatPaise(order.totalPaise - back), strong: true })
  }
  return rows
}

/** What was bought, at the prices captured when the order was placed. */
export function LineItemsCard({ order }: LineItemsCardProps) {
  const rows = totalRows(order)

  return (
    <DataCard title={copy.items.heading}>
      <ul className="divide-y divide-border">
        {order.lines.map((l) => (
          <li key={l.id} className="flex items-center gap-4 py-3 first:pt-0">
            {l.imageUrl ? (
              // biome-ignore lint/performance/noImgElement: remote merchant media, unknown host list.
              <img
                src={l.imageUrl}
                alt=""
                width={46}
                height={46}
                className="size-[46px] shrink-0 rounded-xl border border-border object-cover"
              />
            ) : (
              <span className="flex size-[46px] shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <Package className="size-5" aria-hidden="true" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{l.title}</p>
              <p className="text-caption text-muted-foreground-soft">
                {[
                  l.variantTitle && l.variantTitle !== 'Default' ? l.variantTitle : null,
                  l.sku ? `${copy.items.sku} ${l.sku}` : null,
                ]
                  .filter(Boolean)
                  .join(', ')}{' '}
                {formatPaise(l.unitPricePaise)} × {l.quantity}
              </p>
            </div>
            <p className="shrink-0 font-medium tabular-nums">
              {formatPaise(l.unitPricePaise * l.quantity)}
            </p>
          </li>
        ))}
      </ul>
      <dl className="mt-4 flex flex-col gap-2 border-t border-border pt-4">
        {rows.map((r) => (
          <div
            key={r.label}
            className={`flex justify-between ${r.strong ? 'font-semibold' : ''} ${r.muted ? 'text-muted-foreground' : ''}`}
          >
            <dt>{r.label}</dt>
            <dd className="tabular-nums">{r.value}</dd>
          </div>
        ))}
      </dl>
    </DataCard>
  )
}
