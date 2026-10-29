'use client'

import type { CourierRateRow } from '@commerce/core'
import { cn } from '@commerce/ui/lib/utils'
import StatusChip from '@/components/layout/status-chip'
import { createShipmentContent } from '@/data/create-shipment'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { courierInitials } from './courier-groups'

type CourierOptionProps = {
  row: CourierRateRow
  selected: boolean
  onSelect: () => void
}

const SHORT_DATE = { weekday: 'short', day: 'numeric', month: 'short' } as const

/** One courier service in step 2: logo tile, name with its badges, delivery line and price (or
 *  "rate on booking"), and under it the price breakdown when the courier itemised one. A
 *  courier that can't take the parcel is dimmed, says why in red and can't be picked; the
 *  others still can. */
export default function CourierOption({ row, selected, onSelect }: CourierOptionProps) {
  // Hooks
  const copy = useCopy(createShipmentContent.courier)
  const fmt = useFormat()

  // Render logic
  const blocked = row.problem !== null
  const date = row.deliveryBy ? fmt.pattern(row.deliveryBy, SHORT_DATE) : null
  const delivery = date
    ? row.etaFromSettings
      ? copy.deliveryAbout(date)
      : copy.deliveryBy(date)
    : copy.noDate
  const weight =
    row.chargeableWeightGrams === null
      ? null
      : `${fmt.number(Math.round(row.chargeableWeightGrams / 10) / 100)} kg`
  const showBreakdown =
    !blocked && row.pricePaise !== null && (row.charges.length > 0 || weight !== null)

  return (
    <div className="flex flex-col gap-1">
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
        <span
          aria-hidden
          className="flex size-10 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-caption font-semibold text-ink-strong"
        >
          {courierInitials(row.providerLabel)}
        </span>
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
              {row.codAvailable === null ? '' : ` · ${row.codAvailable ? copy.codYes : copy.codNo}`}
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
      {showBreakdown ? (
        <details className="group/breakdown rounded-lg border border-hairline bg-muted/40 px-3 py-2 text-caption">
          <summary className="cursor-pointer select-none text-muted-foreground marker:text-muted-foreground hover:text-ink-strong">
            {copy.breakdown}
          </summary>
          <dl className="mt-2 flex flex-col gap-1">
            {row.charges.map((c) => (
              <div key={c.kind} className="flex justify-between gap-3">
                <dt className="text-muted-foreground">{copy.charge[c.kind]}</dt>
                <dd className="tabular-nums text-ink-strong">{fmt.money(c.pricePaise)}</dd>
              </div>
            ))}
            {row.charges.length === 0 ? (
              <p className="text-muted-foreground">{copy.noBreakdown}</p>
            ) : null}
            <div className="flex justify-between gap-3 border-t border-hairline pt-1 font-medium">
              <dt className="text-ink-strong">{copy.total}</dt>
              <dd className="tabular-nums text-ink-strong">{fmt.money(row.pricePaise ?? 0)}</dd>
            </div>
            {weight ? (
              <p className="text-muted-foreground">{copy.chargeableWeight(weight)}</p>
            ) : null}
          </dl>
        </details>
      ) : null}
    </div>
  )
}
