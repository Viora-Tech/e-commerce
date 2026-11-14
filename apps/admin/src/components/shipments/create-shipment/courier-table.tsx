'use client'

import type { CourierRateRow } from '@commerce/core'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { Fragment } from 'react'
import StatusChip from '@/components/layout/status-chip'
import { createShipmentContent } from '@/data/create-shipment'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'
import BreakdownReveal from './breakdown-reveal'
import CourierMark from './courier-mark'
import { courierRowClass } from './courier-row-style'
import { coverNotes } from './cover-notes'
import { rowInsuranceState } from './insured-rows'
import PriceBreakdownStrip from './price-breakdown-strip'
import { type ParcelSize, priceCalculation } from './price-calculation'

type CourierTableProps = {
  rows: readonly CourierRateRow[]
  pick: string
  onPick: (optionKey: string) => void
  /** Books that courier at once. Absent while the prices answer an older package. */
  onShipNow?: ((optionKey: string) => void) | undefined
  /** The option whose Ship now is booking. */
  shippingKey: string | null
  /** The insurance toggle is on: a row whose fee is known says it is in the price
   *  (`insuredRows` added it); a row without a rate says so and links to Routes. */
  insured: boolean
  /** The parcel's charged weight, for a courier that did not say its own. */
  chargedGrams?: number | null | undefined
  /** The package as typed (weight and box), for the dead vs volumetric weight lines. */
  parcel?: ParcelSize | null | undefined
}

const SHORT_DATE = { weekday: 'short', day: 'numeric', month: 'short' } as const

const kg = (grams: number) => Math.round(grams / 10) / 100

/**
 * The Select courier drawer's table (Figma 898:7790): logo with its badge under it, name and
 * how it is booked, delivery date and days, charged weight, charges, and Ship now. The picked
 * row opens its price worked out under it (`priceCalculation`, `BreakdownReveal`). A courier that cannot take the parcel is dimmed and
 * says why; the rest stay bookable.
 */
export default function CourierTable({
  rows,
  pick,
  onPick,
  onShipNow,
  shippingKey,
  insured,
  chargedGrams = null,
  parcel = null,
}: CourierTableProps) {
  // Hooks
  const copy = useCopy(createShipmentContent)
  const fmt = useFormat()

  // Render logic
  const d = copy.drawer
  const c = copy.courier

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[44rem] border-collapse text-body">
        <thead>
          <tr className="bg-muted/50 text-left text-caption uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-2.5 font-medium md:pl-8">{d.columns.courier}</th>
            <th className="px-4 py-2.5 font-medium">{d.columns.delivery}</th>
            <th className="px-4 py-2.5 font-medium">{d.columns.weight}</th>
            <th className="px-4 py-2.5 font-medium">{d.columns.charges}</th>
            <th className="px-4 py-2.5">
              <span className="sr-only">{d.shipNow}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const blocked = row.problem !== null
            const picked = pick === row.optionKey
            const date = row.deliveryBy ? fmt.pattern(row.deliveryBy, SHORT_DATE) : null
            const badge = row.badges.includes('recommended')
              ? { label: c.recommended, tone: 'info' as const }
              : row.badges.includes('cheapest')
                ? { label: c.cheapest, tone: 'success' as const }
                : row.badges.includes('fastest')
                  ? { label: c.fastest, tone: 'violet' as const }
                  : null
            const via = row.providerName && !row.providerLabel.includes(row.providerName)
            const sub = blocked
              ? `${c.problem[row.problem ?? 'unreachable']}${row.problemDetail && row.problem !== 'no_cod' ? ` (${row.problemDetail})` : ''}`
              : [
                  via ? d.via(row.providerName) : null,
                  row.codAvailable === null ? null : row.codAvailable ? c.codYes : c.codNo,
                ]
                  .filter(Boolean)
                  .join(' · ')
            const cover = rowInsuranceState(row, insured).kind
            // The picked row's price worked out: weight, courier lines, insurance, total.
            const calc = picked ? priceCalculation(row, { insured, parcel, chargedGrams }) : null
            return (
              <Fragment key={row.optionKey}>
                <tr
                  aria-selected={picked}
                  onClick={blocked ? undefined : () => onPick(row.optionKey)}
                  className={cn(
                    'border-t border-hairline align-middle',
                    courierRowClass(picked, blocked),
                  )}
                >
                  <td className="px-4 py-4 md:pl-8">
                    <div className="flex flex-col items-start gap-1.5">
                      <div className="flex items-center gap-3">
                        <CourierMark label={row.providerLabel} />
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <span className="font-medium text-ink-strong">
                            {row.providerLabel}
                            {row.chosenAtCheckout ? (
                              <StatusChip tone="violet" variant="outline" className="ml-2">
                                {c.chosenAtCheckout}
                              </StatusChip>
                            ) : null}
                          </span>
                          {sub ? (
                            <span
                              className={cn(
                                'text-caption',
                                blocked ? 'text-danger' : 'text-muted-foreground',
                              )}
                            >
                              {sub}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      {badge ? (
                        <StatusChip tone={badge.tone} variant="outline">
                          {badge.label}
                        </StatusChip>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    {blocked ? (
                      '—'
                    ) : (
                      <div className="flex flex-col">
                        <span className="text-ink-strong">{date ?? c.noDate}</span>
                        {row.maxTransitDays !== null ? (
                          <span className="text-caption text-muted-foreground">
                            {d.inDays(row.maxTransitDays)}
                          </span>
                        ) : null}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4 tabular-nums">
                    {blocked || (row.chargeableWeightGrams ?? chargedGrams) === null
                      ? '—'
                      : `${fmt.number(kg(row.chargeableWeightGrams ?? chargedGrams ?? 0))} kg`}
                  </td>
                  <td className="px-4 py-4">
                    {blocked ? (
                      '—'
                    ) : row.pricePaise === null ? (
                      <span className="text-caption text-muted-foreground">{c.rateOnBooking}</span>
                    ) : (
                      <div className="flex flex-col">
                        <span className="text-lg font-semibold tabular-nums text-ink-strong">
                          {fmt.money(row.pricePaise)}
                        </span>
                        <span className="text-caption text-muted-foreground">
                          {cover === 'added' || cover === 'included'
                            ? d.inclGstInsurance
                            : d.inclGst}
                        </span>
                        {cover === 'unset' ? (
                          <Link
                            href={routes.apps.page('delivery-options', 'routes')}
                            onClick={(e) => e.stopPropagation()}
                            className="text-caption text-warning underline-offset-2 hover:underline"
                          >
                            {d.insuranceUnset}
                          </Link>
                        ) : null}
                        {coverNotes(row, insured, 0).usedNotCovered ? (
                          <span className="max-w-[14rem] text-caption text-warning">
                            {d.usedNotCovered(row.providerName)}
                          </span>
                        ) : null}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4 text-right md:pr-8">
                    {onShipNow && !blocked ? (
                      <Button
                        size="sm"
                        variant={picked ? 'default' : 'outline'}
                        loading={shippingKey === row.optionKey}
                        disabled={shippingKey !== null}
                        onClick={(e) => {
                          e.stopPropagation()
                          onShipNow(row.optionKey)
                        }}
                      >
                        {d.shipNow}
                      </Button>
                    ) : null}
                  </td>
                </tr>
                {/* Always here (empty: no height) so the old pick's breakdown can close while
                    the new one opens, instead of the rows below jumping. */}
                <tr className="bg-muted/40">
                  <td colSpan={5} className="p-0">
                    <BreakdownReveal open={calc !== null} className="px-4 py-3.5 md:px-8">
                      {calc ? (
                        <PriceBreakdownStrip
                          calc={calc}
                          estimateHint={d.insuranceEstimateHint}
                          className="md:pl-[4.25rem]"
                        />
                      ) : null}
                    </BreakdownReveal>
                  </td>
                </tr>
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
