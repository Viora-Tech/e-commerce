'use client'

import { shippingMargin } from '@commerce/core/delivery-margin'
import DataCard from '@/components/layout/data-card'
import StatusChip from '@/components/layout/status-chip'
import TotalsList, { type TotalsLine } from '@/components/layout/totals-list'
import { deliveryRouteCardContent } from '@/data/order-cards'
import { useCopy, useFormat } from '@/hooks/use-copy'
import DeliveryParcelRoutes from './delivery-parcel-routes'
import { cap, type OrderDetail } from './order-detail-types'

type DeliveryRouteCardProps = {
  /** Its saved route (`shipping.delivery`), shipping charged, latest booking and parcels. */
  order: OrderDetail
  /** The margin is a cost figure: only staff who see profit see it. */
  showMargin: boolean
}

/**
 * A Delivery options order's thread: the option and the route chosen at checkout ("Express ·
 * Blue Dart Air via Shiprocket · insured · promised"), or, for a cart split across locations,
 * one line per parcel with its own courier; the "Placed on backup" marker when couriers were
 * down, and the shipping margin (charged against courier cost plus insurance). Nothing for an
 * order placed without the Delivery options app.
 */
export default function DeliveryRouteCard({ order, showMargin }: DeliveryRouteCardProps) {
  // Hooks
  const copy = useCopy(deliveryRouteCardContent)
  const fmt = useFormat()

  // Helpers
  const signed = (paise: number) => (paise < 0 ? `−${fmt.money(-paise)}` : fmt.money(paise))

  // Early returns
  const delivery = order.shipping?.delivery
  if (!delivery) return null

  // Render logic
  const chargedPaise = order.shippingPaise
  const bookingChargePaise = order.shipment?.courierChargePaise ?? null
  const route = delivery.route
  const backup = delivery.quoteSource === 'backup' || !route
  // A cart split across locations: each parcel's own courier, one line each.
  const split = delivery.parcels?.length ? delivery.parcels : null
  const promised =
    delivery.promisedEarliest && delivery.promisedLatest
      ? delivery.promisedEarliest === delivery.promisedLatest
        ? fmt.date(delivery.promisedEarliest)
        : `${fmt.date(delivery.promisedEarliest)} – ${fmt.date(delivery.promisedLatest)}`
      : null
  const margin = shippingMargin(delivery, chargedPaise, bookingChargePaise)
  const lines: TotalsLine[] = [
    { label: copy.charged, value: fmt.money(margin.chargedPaise) },
    ...(margin.courierPaise !== null && margin.courierFrom
      ? [
          {
            label: copy.courier,
            value: `−${fmt.money(margin.courierPaise)}`,
            detail: <span>· {copy.courierFrom[margin.courierFrom]}</span>,
          },
        ]
      : []),
    ...(delivery.insured
      ? [{ label: copy.insurance, value: `−${fmt.money(margin.insurancePaise)}` }]
      : []),
    ...(margin.marginPaise !== null
      ? [
          {
            label: copy.margin,
            value: signed(margin.marginPaise),
            strong: true,
            negative: margin.marginPaise < 0,
          },
        ]
      : []),
  ]

  return (
    <DataCard
      title={copy.title}
      action={backup ? <StatusChip tone="attention">{copy.backupTag}</StatusChip> : null}
    >
      <div className="flex flex-col gap-1 text-body">
        <p className="font-medium text-ink-strong">
          {route && !split ? `${delivery.optionName} · ${route.carrier}` : delivery.optionName}
        </p>
        {split ? <DeliveryParcelRoutes routes={split} parcels={order.parcels} /> : null}
        {route && !split ? (
          <p className="text-caption text-muted-foreground">
            {route.channel === 'aggregator'
              ? copy.via(route.serviceLabel, cap(route.providerId))
              : route.serviceLabel}
          </p>
        ) : null}
        {!split && (delivery.insured || promised) ? (
          <p className="text-caption text-muted-foreground">
            {[delivery.insured ? copy.insured : null, promised ? copy.promised(promised) : null]
              .filter(Boolean)
              .join(' · ')}
          </p>
        ) : null}
        {backup ? <p className="text-caption text-muted-foreground">{copy.backupHelp}</p> : null}
      </div>
      {showMargin ? (
        <div className="mt-3">
          <TotalsList lines={lines} />
          {margin.marginPaise === null ? (
            <p className="mt-2 text-caption text-muted-foreground">{copy.marginUnknown}</p>
          ) : null}
        </div>
      ) : null}
    </DataCard>
  )
}
