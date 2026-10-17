'use client'

import type { CourierRateRow } from '@commerce/core'
import { Truck } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import DataCard from '@/components/layout/data-card'
import KeyValueList from '@/components/layout/key-value-list'
import TotalsList from '@/components/layout/totals-list'
import { createShipmentContent } from '@/data/create-shipment'
import { useCopy, useFormat } from '@/hooks/use-copy'
import type { DraftOrder, ParsedPackage } from './flow-state'

type SummaryCardProps = {
  order: DraftOrder
  units: number
  route: string
  pkg: ParsedPackage | null
  /** The picked courier's rate, or null for "ship it yourself" / nothing picked yet. */
  courier: CourierRateRow | null
  manual: boolean
  canBook: boolean
  busy: boolean
  onBook: () => void
}

const SHORT_DATE = { weekday: 'short', day: 'numeric', month: 'short' } as const

/** Figma Create shipment, right column: what is about to be booked, the charge, and Book. */
export default function SummaryCard({
  order,
  units,
  route,
  pkg,
  courier,
  manual,
  canBook,
  busy,
  onBook,
}: SummaryCardProps) {
  // Hooks
  const content = useCopy(createShipmentContent)
  const fmt = useFormat()

  // Render logic
  const page = content.page
  const review = content.review
  const payment = !pkg
    ? '—'
    : pkg.paymentMode === 'cod'
      ? review.codCollect(fmt.money(pkg.codAmountPaise ?? 0))
      : review.prepaid
  const charge =
    courier?.pricePaise != null
      ? fmt.money(courier.pricePaise)
      : courier
        ? content.courier.rateOnBooking
        : null

  return (
    <DataCard title={page.summary} className="lg:sticky lg:top-6">
      <KeyValueList
        variant="grid"
        rows={[
          {
            label: review.order,
            value: `#${order.orderNumber} · ${content.package.itemCount(units)}`,
          },
          { label: page.route, value: route },
          { label: page.chargedWeight, value: pkg ? review.grams(pkg.weightGrams) : '—' },
          { label: review.payment, value: payment },
          {
            label: review.courier,
            value: manual ? content.courier.manual : (courier?.providerLabel ?? '—'),
          },
          {
            label: review.delivery,
            value: courier?.deliveryBy ? fmt.pattern(courier.deliveryBy, SHORT_DATE) : '—',
            hidden: manual,
          },
        ]}
      />
      <div className="mt-4 flex flex-col gap-3">
        {charge ? (
          <TotalsList lines={[{ label: page.courierCharge, value: charge, strong: true }]} />
        ) : manual ? null : (
          <p className="text-caption text-muted-foreground">{page.chooseFirst}</p>
        )}
        <Button className="w-full" disabled={!canBook || busy} loading={busy} onClick={onBook}>
          <Truck aria-hidden="true" />
          {busy ? review.booking : manual ? review.saveManual : review.book}
        </Button>
        <p className="text-center text-caption text-muted-foreground">
          {manual ? page.manualNote : page.walletNote}
        </p>
      </div>
    </DataCard>
  )
}
