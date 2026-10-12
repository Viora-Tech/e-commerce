'use client'

import ChoiceField from '@/components/apps/gst-invoices/choice-field'
import { createShipmentContent } from '@/data/create-shipment'
import { useCopy, useFormat } from '@/hooks/use-copy'
import {
  type BulkSkip,
  type DraftOrder,
  type DraftParcel,
  OWN_WEIGHT,
  type ShipmentDraft,
} from './flow-state'

type BulkPackageStepProps = {
  ready: Array<{ order: DraftOrder; parcel: DraftParcel }>
  skipped: BulkSkip[]
  boxes: ShipmentDraft['boxes']
  /** OWN_WEIGHT, or the id of the box every parcel goes in. */
  boxId: string
  onBoxChange: (boxId: string) => void
}

/** Bulk step 1: the orders in the batch, the ones left out and why, and the box for all. */
export default function BulkPackageStep({
  ready,
  skipped,
  boxes,
  boxId,
  onBoxChange,
}: BulkPackageStepProps) {
  // Hooks
  const copy = useCopy(createShipmentContent)
  const fmt = useFormat()

  // Render logic
  const b = copy.bulkPackage
  const options = [
    { value: OWN_WEIGHT, label: b.ownWeight },
    ...boxes.map((box) => ({
      value: box.id,
      label: copy.package.boxLabel(box.name, box.lengthCm, box.widthCm, box.heightCm),
    })),
  ]

  return (
    <div className="flex flex-col gap-5">
      {ready.length === 0 ? (
        <p className="text-body text-muted-foreground">{b.noneLeft}</p>
      ) : (
        <section className="flex flex-col gap-2">
          <p className="text-body font-medium text-ink-strong">{b.heading}</p>
          <ul className="flex flex-col divide-y divide-hairline rounded-lg border border-hairline">
            {ready.map(({ order, parcel }) => (
              <li key={order.orderId} className="flex justify-between gap-3 px-3 py-2 text-body">
                <span className="min-w-0 truncate">
                  <span className="font-medium text-ink-strong">#{order.orderNumber}</span>
                  {[order.customerName, order.city].filter(Boolean).length > 0
                    ? ` · ${[order.customerName, order.city].filter(Boolean).join(', ')}`
                    : ''}
                </span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {copy.review.grams(parcel.weightGrams)}
                  {order.paymentMode === 'cod' ? ` · ${copy.package.cod}` : ''}
                  {` · ${fmt.money(parcel.valuePaise)}`}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {ready.length > 0 && boxes.length > 0 ? (
        <ChoiceField
          id="bulk-box"
          label={b.weightMode}
          value={boxId}
          options={options}
          onChange={onBoxChange}
        />
      ) : null}

      {skipped.length > 0 ? (
        <section className="flex flex-col gap-2">
          <p className="text-body font-medium text-ink-strong">{b.skipped}</p>
          <ul className="flex flex-col gap-1 text-caption text-muted-foreground">
            {skipped.map(({ order, reason }) => (
              <li key={order.orderId}>
                #{order.orderNumber}: {b.blocked[reason]}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
