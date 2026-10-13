'use client'

import type { CourierRateRow } from '@commerce/core'
import type { ReactNode } from 'react'
import { createShipmentContent } from '@/data/create-shipment'
import { useCopy, useFormat } from '@/hooks/use-copy'
import type { DraftOrder, DraftParcel, ParsedPackage } from './flow-state'

type ReviewStepProps = {
  order: DraftOrder
  parcel: DraftParcel
  pkg: ParsedPackage
  pickupLabel: string
  /** The courier row picked in step 2; null when shipping it yourself. */
  courier: CourierRateRow | null
  /** "Ship it yourself": the courier name and AWB typed in step 2. */
  manual: { courier: string; awb: string } | null
}

const SHORT_DATE = { weekday: 'short', day: 'numeric', month: 'short' } as const

/** Step 3: everything that will be sent to the courier, one line each, before Book shipment. */
export default function ReviewStep({
  order,
  parcel,
  pkg,
  pickupLabel,
  courier,
  manual,
}: ReviewStepProps) {
  // Hooks
  const copy = useCopy(createShipmentContent)
  const fmt = useFormat()

  // Render logic
  const r = copy.review
  const units = parcel.lines.reduce((n, l) => n + l.quantity, 0)
  const size = pkg.dimensionsCm
    ? ` · ${pkg.dimensionsCm.length} × ${pkg.dimensionsCm.width} × ${pkg.dimensionsCm.height} cm`
    : ''
  const rows: Array<[string, ReactNode]> = [
    [r.order, `#${order.orderNumber}`],
    [r.shipTo, [order.customerName, order.city, order.pincode].filter(Boolean).join(', ')],
    [r.from, pickupLabel],
    [
      r.parcel,
      `${parcel.locationName ? `${parcel.locationName} · ` : ''}${copy.package.itemCount(units)}`,
    ],
    [r.weight, `${r.grams(pkg.weightGrams)}${size}`],
    [
      r.payment,
      pkg.paymentMode === 'cod' ? r.codCollect(fmt.money(pkg.codAmountPaise ?? 0)) : r.prepaid,
    ],
  ]
  if (manual) {
    rows.push([r.courier, r.manualCourier(manual.courier)], [r.awb, manual.awb])
  } else if (courier) {
    rows.push(
      [r.courier, courier.providerLabel],
      [
        r.price,
        courier.pricePaise === null ? copy.courier.rateOnBooking : fmt.money(courier.pricePaise),
      ],
      [
        r.delivery,
        courier.deliveryBy
          ? copy.courier.deliveryBy(fmt.pattern(courier.deliveryBy, SHORT_DATE))
          : copy.courier.noDate,
      ],
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-body font-medium text-ink-strong">{r.heading}</p>
      <dl className="flex flex-col divide-y divide-hairline rounded-lg border border-hairline">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4 px-3 py-2 text-body">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="min-w-0 text-right text-ink-strong">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}
