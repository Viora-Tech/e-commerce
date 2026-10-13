'use client'

import type { CourierRateRow } from '@commerce/core'
import { cn } from '@commerce/ui/lib/utils'
import { Badge } from '@commerce/ui/shadcn/badge'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@commerce/ui/shadcn/table'
import PillTabs from '@/components/layout/pill-tabs'
import { createShipmentContent } from '@/data/create-shipment'
import { useCopy, useFormat } from '@/hooks/use-copy'
import type { BulkMode, CourierTotal } from './flow-state'

type BulkCourierStepProps = {
  /** Null while the couriers are being asked. */
  totals: CourierTotal[] | null
  orderCount: number
  mode: BulkMode
  onModeChange: (mode: BulkMode) => void
  providerId: string | null
  onProviderChange: (providerId: string) => void
  /** Each order's courier under the mode; null when none can take it. */
  picks: Array<{ orderId: string; orderNumber: number; row: CourierRateRow | null }>
}

const SHORT_DATE = { weekday: 'short', day: 'numeric', month: 'short' } as const

/** Bulk step 2: one courier for the whole batch (with its total), or the cheapest or fastest
 *  for each order, and what each order gets under that choice. */
export default function BulkCourierStep({
  totals,
  orderCount,
  mode,
  onModeChange,
  providerId,
  onProviderChange,
  picks,
}: BulkCourierStepProps) {
  // Hooks
  const copy = useCopy(createShipmentContent)
  const fmt = useFormat()

  // Early returns
  if (!totals) {
    return (
      <p className="flex items-center gap-2 py-6 text-body text-muted-foreground">
        <Spinner />
        {copy.courier.checking}
      </p>
    )
  }

  // Render logic
  const b = copy.bulkCourier

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <p className="text-body font-medium text-ink-strong">{b.mode}</p>
        <PillTabs<BulkMode>
          variant="segmented"
          value={mode}
          onChange={onModeChange}
          tabs={[
            { value: 'one', label: b.one },
            { value: 'cheapest', label: b.cheapest },
            { value: 'fastest', label: b.fastest },
          ]}
        />
      </div>

      {mode === 'one' ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {totals.map((t) => {
            const selected = t.providerId === providerId
            const total = fmt.money(t.pricePaise)
            return (
              <button
                key={t.providerId}
                type="button"
                aria-pressed={selected}
                disabled={t.canTake === 0}
                onClick={() => onProviderChange(t.providerId)}
                className={cn(
                  'motion-press flex flex-col gap-1 rounded-lg border p-3 text-left disabled:cursor-not-allowed disabled:bg-muted/40',
                  selected
                    ? 'border-primary bg-primary-soft ring-1 ring-primary'
                    : 'border-hairline bg-card',
                )}
              >
                <span className="flex flex-wrap items-center gap-1.5">
                  <span className="font-medium text-ink-strong">{t.label}</span>
                  {t.recommended ? (
                    <Badge variant="success">{copy.courier.recommended}</Badge>
                  ) : null}
                </span>
                <span className="text-caption text-muted-foreground">
                  {t.canTake === 0
                    ? b.noCourierFor
                    : t.unpriced > 0
                      ? t.pricePaise > 0
                        ? b.partlyPriced(total)
                        : copy.courier.rateOnBooking
                      : b.total(total)}
                  {` · ${b.canTake(t.canTake, orderCount)}`}
                </span>
              </button>
            )
          })}
        </div>
      ) : null}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{b.columns.order}</TableHead>
            <TableHead>{b.columns.courier}</TableHead>
            <TableHead>{b.columns.price}</TableHead>
            <TableHead>{b.columns.delivery}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {picks.map(({ orderId, orderNumber, row }) => (
            <TableRow key={orderId}>
              <TableCell className="font-medium">#{orderNumber}</TableCell>
              {row ? (
                <>
                  <TableCell>{row.providerLabel}</TableCell>
                  <TableCell className="tabular-nums">
                    {row.pricePaise === null
                      ? copy.courier.rateOnBooking
                      : fmt.money(row.pricePaise)}
                  </TableCell>
                  <TableCell>
                    {row.deliveryBy ? fmt.pattern(row.deliveryBy, SHORT_DATE) : copy.courier.noDate}
                  </TableCell>
                </>
              ) : (
                <TableCell colSpan={3} className="text-danger">
                  {b.noCourierFor}
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
