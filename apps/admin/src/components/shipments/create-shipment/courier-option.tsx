'use client'

import type { CourierRateRow } from '@commerce/core'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import StatusChip from '@/components/layout/status-chip'
import { createShipmentContent } from '@/data/create-shipment'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { courierInitials } from './courier-groups'
import { courierLogoSrc } from './courier-logo'
import { type ParcelSize, priceCalculation } from './price-calculation'
import PriceCalculationList from './price-calculation-list'

type CourierOptionProps = {
  row: CourierRateRow
  selected: boolean
  onSelect: () => void
  /** Books this courier straight away (the Select courier drawer); absent: pick only. */
  onShipNow?: (() => void) | undefined
  /** This row's booking is running. */
  shipping?: boolean | undefined
  /** The insurance switch is on and `row` is `insuredRows`' output (its price holds the fee). */
  insured?: boolean | undefined
  /** The package as typed, for the dead vs volumetric weight lines. */
  parcel?: ParcelSize | null | undefined
}

const SHORT_DATE = { weekday: 'short', day: 'numeric', month: 'short' } as const

/** One courier service in step 2: logo tile, name with its badges, delivery line and price (or
 *  "rate on booking"), and under the picked one its price worked out (`priceCalculation`). A
 *  courier that can't take the parcel is dimmed, says why in red and can't be picked; the
 *  others still can. */
export default function CourierOption({
  row,
  selected,
  onSelect,
  onShipNow,
  shipping = false,
  insured = false,
  parcel = null,
}: CourierOptionProps) {
  // Hooks
  const copy = useCopy(createShipmentContent.courier)
  const drawerCopy = useCopy(createShipmentContent.drawer)
  const fmt = useFormat()

  // Render logic
  const blocked = row.problem !== null
  const date = row.deliveryBy ? fmt.pattern(row.deliveryBy, SHORT_DATE) : null
  const delivery = date
    ? row.etaFromSettings
      ? copy.deliveryAbout(date)
      : copy.deliveryBy(date)
    : copy.noDate
  const logo = courierLogoSrc(row.providerLabel)
  // The picked row's price worked out, as in the drawer's table.
  const calc = selected ? priceCalculation(row, { insured, parcel }) : null

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-stretch gap-2">
        <button
          type="button"
          aria-pressed={selected}
          disabled={blocked}
          onClick={onSelect}
          className={cn(
            'motion-press flex w-full items-center gap-3 rounded-lg border bg-card p-3 text-left',
            selected ? 'border-primary ring-1 ring-primary' : 'border-hairline',
            blocked ? 'cursor-not-allowed opacity-60' : 'hover:border-border-strong',
          )}
        >
          <span
            aria-hidden
            className={cn(
              'flex size-4 shrink-0 items-center justify-center rounded-full border',
              selected ? 'border-primary bg-primary' : 'border-input',
            )}
          >
            {selected ? <span className="size-1.5 rounded-full bg-primary-foreground" /> : null}
          </span>
          {logo ? (
            <span
              aria-hidden
              className={cn(
                'flex h-10 w-14 shrink-0 items-center justify-center overflow-hidden rounded-md',
                logo.light && 'bg-white px-1',
              )}
            >
              {/* biome-ignore lint/performance/noImgElement: a small static logo from /public. */}
              <img src={logo.src} alt="" className="max-h-8 max-w-full object-contain" />
            </span>
          ) : (
            <span
              aria-hidden
              className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-caption font-semibold text-ink-strong"
            >
              {courierInitials(row.providerLabel)}
            </span>
          )}
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="flex flex-wrap items-center gap-1.5">
              <span className="font-medium text-ink-strong">{row.providerLabel}</span>
              {row.chosenAtCheckout ? (
                <StatusChip tone="attention">{copy.chosenAtCheckout}</StatusChip>
              ) : null}
              {row.badges.includes('recommended') ? (
                <StatusChip tone="info">{copy.recommended}</StatusChip>
              ) : null}
              {row.badges.includes('cheapest') ? (
                <StatusChip tone="success">{copy.cheapest}</StatusChip>
              ) : null}
              {row.badges.includes('fastest') ? (
                <StatusChip tone="violet">{copy.fastest}</StatusChip>
              ) : null}
            </span>
            {blocked ? (
              <span className="text-caption text-danger">
                {copy.problem[row.problem ?? 'unreachable']}
                {row.problemDetail && row.problem !== 'no_cod' ? ` (${row.problemDetail})` : ''}
              </span>
            ) : (
              <span className="text-caption text-muted-foreground">
                {delivery}
                {row.codAvailable === null
                  ? ''
                  : ` · ${row.codAvailable ? copy.codYes : copy.codNo}`}
              </span>
            )}
          </span>
          {blocked ? null : (
            <span className="flex shrink-0 flex-col items-end">
              {row.pricePaise === null ? (
                <span className="text-caption text-muted-foreground">{copy.rateOnBooking}</span>
              ) : (
                <>
                  <span className="text-lg font-semibold tabular-nums text-ink-strong">
                    {fmt.money(row.pricePaise)}
                  </span>
                  <span className="text-caption text-muted-foreground">{copy.inclGst}</span>
                </>
              )}
            </span>
          )}
        </button>
        {onShipNow && !blocked ? (
          <Button
            type="button"
            className="h-auto shrink-0 self-stretch px-4"
            variant={selected ? 'default' : 'outline'}
            loading={shipping}
            disabled={shipping}
            onClick={onShipNow}
          >
            {drawerCopy.shipNow}
          </Button>
        ) : null}
      </div>
      {calc ? (
        <PriceCalculationList
          calc={calc}
          estimateHint={drawerCopy.insuranceEstimateHint}
          className="rounded-lg border border-hairline bg-muted/40 px-3 py-2.5"
        />
      ) : null}
    </div>
  )
}
