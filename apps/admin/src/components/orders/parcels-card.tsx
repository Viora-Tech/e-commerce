import type { ParcelView } from '@commerce/core'
import { TriangleAlert } from '@commerce/ui/icons'
import DataCard from '@/components/layout/data-card'
import StatusChip from '@/components/layout/status-chip'
import { parcelsCardContent } from '@/data/order-cards'
import { useCopy } from '@/hooks/use-copy'
import type { OrderDetail } from './order-detail-types'

type ParcelsCardProps = {
  order: OrderDetail
}

const STATUS_TONE = {
  open: 'attention',
  on_hold: 'info',
  fulfilled: 'neutral',
  cancelled: 'neutral',
} as const

/** "Kurta / M" without the placeholder variant name. */
function lineName(l: ParcelView['lines'][number]): string {
  const variant = l.variantTitle?.trim()
  const title = l.title?.trim() || '—'
  return variant && variant !== 'Default' && variant !== 'Default Title'
    ? `${title} / ${variant}`
    : title
}

/** Where the order ships from: one block per parcel (warehouse), with its items and GSTIN. */
export default function ParcelsCard({ order }: ParcelsCardProps) {
  // Hooks
  const copy = useCopy(parcelsCardContent)

  // Early returns
  if (order.parcels.length === 0) return null

  // Render logic
  const many = order.parcels.length > 1

  return (
    <DataCard title={copy.title(order.parcels.length)}>
      <ul className="flex flex-col divide-y divide-hairline">
        {order.parcels.map((p) => {
          const place = [p.city, p.stateName ?? p.stateCode].filter(Boolean).join(', ')
          const units = p.lines.reduce((n, l) => n + l.quantity, 0)
          const packed = p.lines.reduce((n, l) => n + l.fulfilledQuantity, 0)
          return (
            <li key={p.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-ink-strong">
                  {many ? `${copy.parcel(p.position)} · ` : ''}
                  {p.locationName}
                </span>
                <StatusChip tone={STATUS_TONE[p.status]}>{copy.status[p.status]}</StatusChip>
                {p.needsTransfer && p.status !== 'fulfilled' && p.status !== 'cancelled' ? (
                  <StatusChip tone="danger">{copy.needsTransfer}</StatusChip>
                ) : null}
              </div>
              <p className="text-caption text-muted-foreground">
                {[place ? copy.from(place) : null, p.gstin ? copy.billedUnder(p.gstin) : null]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              {p.needsTransfer && p.status === 'open' ? (
                <p className="flex items-start gap-1.5 text-caption text-warning-foreground dark:text-warning">
                  <TriangleAlert aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
                  {copy.needsTransferHelp}
                </p>
              ) : null}
              <ul className="flex flex-col gap-1 text-body">
                {p.lines.map((l) => (
                  <li key={l.orderLineId} className="flex justify-between gap-3">
                    <span className="min-w-0 truncate">
                      {l.quantity} × {lineName(l)}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-caption text-muted-foreground">
                {copy.units(units)} · {copy.packed(packed, units)}
              </p>
            </li>
          )
        })}
      </ul>
    </DataCard>
  )
}
