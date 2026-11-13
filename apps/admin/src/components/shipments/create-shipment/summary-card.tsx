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
import { priceCalculation, summaryParts } from './price-calculation'

type SummaryCardProps = {
  order: DraftOrder
  units: number
  route: string
  pkg: ParsedPackage | null
  /** The picked courier's rate, or null for "ship it yourself" / nothing picked yet. */
  courier: CourierRateRow | null
  /** What the couriers bill, once a quote is back. */
  chargedGrams: number | undefined
  /** The pickup the parcel joins, or when it is made ("Later, on Booked"). */
  pickupLine: string | null
  /** Shipping insurance is on: the courier's price includes it. */
  insured: boolean
  /** "Paid from your Delhivery wallet · ₹2,340 left" when that wallet's balance is known. */
  walletNote: string | null
  manual: boolean
  canBook: boolean
  busy: boolean
  onBook: () => void
  /** Nothing picked yet: the button opens the Select courier drawer instead (Figma 898:7376). */
  onSelectCourier?: (() => void) | undefined
}

const SHORT_DATE = { weekday: 'short', day: 'numeric', month: 'short' } as const

/** Figma Create shipment, right column: what is about to be booked, the charge, and Book. */
export default function SummaryCard({
  order,
  units,
  route,
  pkg,
  courier,
  chargedGrams,
  pickupLine,
  insured,
  walletNote,
  manual,
  canBook,
  busy,
  onBook,
  onSelectCourier,
}: SummaryCardProps) {
  // Hooks
  const content = useCopy(createShipmentContent)
  const fmt = useFormat()

  // Helpers
  const money = (paise: number | null | undefined) =>
    paise === null || paise === undefined ? '—' : fmt.money(paise)

  // Render logic
  const page = content.page
  const review = content.review
  const payment = !pkg
    ? '—'
    : pkg.paymentMode === 'cod'
      ? review.codCollect(fmt.money(pkg.codAmountPaise ?? 0))
      : review.prepaid
  const kg = chargedGrams ? `${fmt.number(Math.round(chargedGrams / 10) / 100)} kg` : null
  const weight = !pkg
    ? '—'
    : kg
      ? page.weightValue(review.grams(pkg.weightGrams), kg)
      : review.grams(pkg.weightGrams)
  const calc = courier ? priceCalculation(courier, { insured }) : null
  const parts = calc ? summaryParts(calc) : null
  const charge =
    courier?.pricePaise != null
      ? fmt.money(courier.pricePaise)
      : courier
        ? content.courier.rateOnBooking
        : null

  return (
    <DataCard
      title={page.summary}
      className="lg:sticky lg:top-6 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto no-scrollbar"
    >
      <KeyValueList
        variant="grid"
        rows={[
          {
            label: review.order,
            value: `#${order.orderNumber} · ${content.package.itemCount(units)}`,
          },
          { label: page.route, value: route },
          { label: page.chargedWeight, value: weight },
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
          { label: page.pickupRow, value: pickupLine ?? '—', hidden: manual },
          { label: page.freightRow, value: money(parts?.freightPaise), hidden: manual },
          {
            label: page.codFeeRow,
            value: money(parts?.codPaise),
            hidden: manual || !parts?.codPaise,
          },
          {
            label: page.insuranceRow,
            value: money(parts?.insurancePaise),
            hidden: manual || !parts?.insurancePaise,
          },
          { label: page.gstRow, value: money(parts?.gstPaise), hidden: manual },
        ]}
      />
      <div className="mt-4 flex flex-col gap-3">
        {charge ? (
          <TotalsList lines={[{ label: page.courierCharge, value: charge, strong: true }]} />
        ) : manual ? null : (
          <p className="text-caption text-muted-foreground">{page.chooseFirst}</p>
        )}
        {onSelectCourier && !courier && !manual ? (
          <Button className="w-full" onClick={onSelectCourier}>
            <Truck aria-hidden="true" />
            {content.drawer.open}
          </Button>
        ) : (
          <Button className="w-full" disabled={!canBook || busy} loading={busy} onClick={onBook}>
            <Truck aria-hidden="true" />
            {busy ? review.booking : manual ? review.saveManual : review.book}
          </Button>
        )}
        <p className="text-center text-caption text-muted-foreground">
          {manual ? page.manualNote : (walletNote ?? page.walletNote)}
        </p>
      </div>
    </DataCard>
  )
}
