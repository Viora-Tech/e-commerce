'use client'

import type { CourierRateRow } from '@commerce/core'
import { TriangleAlert } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Badge } from '@commerce/ui/shadcn/badge'
import { createShipmentContent } from '@/data/create-shipment'
import { useCopy, useFormat } from '@/hooks/use-copy'

type CourierOptionProps = {
  row: CourierRateRow
  selected: boolean
  onSelect: () => void
}

const SHORT_DATE = { weekday: 'short', day: 'numeric', month: 'short' } as const

/** One courier in step 2: price (or "rate on booking"), delivery date, COD, and its badges.
 *  A courier that can't take the parcel shows why and can't be picked; the others still can. */
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

  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={blocked}
      onClick={onSelect}
      className={cn(
        'motion-press flex w-full items-start gap-3 rounded-lg border p-3 text-left',
        selected ? 'border-primary bg-primary-soft ring-1 ring-primary' : 'border-hairline bg-card',
        blocked ? 'cursor-not-allowed bg-muted/40' : 'hover:border-border-strong',
      )}
    >
      <span
        aria-hidden
        className={cn(
          'mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border',
          selected ? 'border-primary bg-primary' : 'border-input',
        )}
      >
        {selected ? <span className="size-1.5 rounded-full bg-primary-foreground" /> : null}
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="font-medium text-ink-strong">{row.providerLabel}</span>
          {row.badges.includes('recommended') ? (
            <Badge variant="success">{copy.recommended}</Badge>
          ) : null}
          {row.badges.includes('cheapest') ? (
            <Badge variant="outline">{copy.cheapest}</Badge>
          ) : null}
          {row.badges.includes('fastest') ? <Badge variant="outline">{copy.fastest}</Badge> : null}
        </span>
        {blocked ? (
          <span className="flex items-start gap-1.5 text-caption text-danger">
            <TriangleAlert aria-hidden className="mt-0.5 size-3.5 shrink-0" />
            <span>
              {copy.problem[row.problem ?? 'unreachable']}
              {row.problemDetail && row.problem !== 'no_cod' ? ` (${row.problemDetail})` : ''}
            </span>
          </span>
        ) : (
          <span className="text-caption text-muted-foreground">
            {delivery}
            {row.codAvailable === null ? '' : ` · ${row.codAvailable ? copy.codYes : copy.codNo}`}
          </span>
        )}
      </span>
      {blocked ? null : (
        <span className="shrink-0 text-right">
          {row.pricePaise === null ? (
            <span className="text-caption text-muted-foreground">{copy.rateOnBooking}</span>
          ) : (
            <span className="font-semibold tabular-nums text-ink-strong">
              {fmt.money(row.pricePaise)}
            </span>
          )}
        </span>
      )}
    </button>
  )
}
