'use client'

import { CircleCheck, Printer, TriangleAlert } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import CopyButton from '@/components/fields/copy-button'
import { createShipmentContent } from '@/data/create-shipment'
import { useCopy, useFormat } from '@/hooks/use-copy'
import type { api } from '@/lib/api-client'
import PickupForm from './pickup-form'

type BulkResult = Awaited<ReturnType<typeof api.shipments.bulkBook>>[number]

type BulkDoneStepProps = {
  results: BulkResult[]
  numbers: Map<string, number>
  /** The day a pickup was requested for right after booking; null offers the form instead. */
  pickupDate?: string | null
}

/** Bulk step 4: booked or not, order by order, then all the labels and one pickup request. */
export default function BulkDoneStep({ results, numbers, pickupDate = null }: BulkDoneStepProps) {
  // Hooks
  const copy = useCopy(createShipmentContent.done)
  const pickupCopy = useCopy(createShipmentContent.pickup)
  const fmt = useFormat()

  // Event handlers
  const handlePrintAll = () => {
    for (const r of results) {
      if (r.ok && r.labelUrl) window.open(r.labelUrl, '_blank', 'noopener')
    }
  }

  // Render logic
  const booked = results.filter((r) => r.ok)
  const shipmentIds = booked.flatMap((r) => (r.shipmentId ? [r.shipmentId] : []))
  const labels = booked.some((r) => r.labelUrl)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="font-medium text-ink-strong">
          {copy.bulkHeading(booked.length, results.length)}
        </p>
        {labels ? (
          <Button variant="outline" onClick={handlePrintAll}>
            <Printer aria-hidden />
            {copy.printAll}
          </Button>
        ) : null}
      </div>
      <ul className="flex flex-col divide-y divide-hairline rounded-lg border border-hairline">
        {results.map((r) => (
          <li key={r.orderId} className="flex items-start gap-2 px-3 py-2 text-body">
            {r.ok ? (
              <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-success" />
            ) : (
              <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-danger" />
            )}
            <span className="font-medium text-ink-strong">#{numbers.get(r.orderId) ?? '—'}</span>
            <span className={r.ok ? 'text-muted-foreground' : 'text-danger'}>
              {r.ok ? copy.booked(r.waybill ?? '') : `${copy.failed}: ${r.error ?? ''}`}
            </span>
            {r.ok && r.waybill ? <CopyButton value={r.waybill} what={copy.awb} visible /> : null}
          </li>
        ))}
      </ul>
      {pickupDate ? (
        <p className="text-body text-muted-foreground">
          {pickupCopy.requestedFor(
            fmt.pattern(pickupDate, { weekday: 'short', day: 'numeric', month: 'short' }),
          )}
        </p>
      ) : shipmentIds.length > 0 ? (
        <PickupForm shipmentIds={shipmentIds} />
      ) : null}
    </div>
  )
}
