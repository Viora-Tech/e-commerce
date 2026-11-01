'use client'

import ToggleRow from '@/components/apps/gst-invoices/toggle-row'
import DataCard from '@/components/layout/data-card'
import { localDeliveryContent } from '@/data/local-delivery'
import { useCopy } from '@/hooks/use-copy'

type SplitShippingCardProps = {
  /** `store.shipping.routing.maxParcels`: 1 keeps every order in one parcel. */
  maxParcels: number
  onChange: (maxParcels: number) => void
}

/** Parcels an order may split into when the switch goes on (Settings › Locations sets more). */
const DEFAULT_SPLIT = 2

/**
 * Split shipping (audit #163): one order may ship in several shipments. Checkout routing and
 * fulfilment already split orders across locations (`order/routing.ts`, up to `maxParcels`), so
 * the switch only moves that limit between 1 (off) and 2 or more (on).
 */
export default function SplitShippingCard({ maxParcels, onChange }: SplitShippingCardProps) {
  // Hooks
  const { split: copy } = useCopy(localDeliveryContent)

  // Render logic
  const on = maxParcels > 1

  return (
    <DataCard title={copy.heading}>
      <div className="flex flex-col gap-3">
        <p className="text-body text-muted-foreground">{copy.help}</p>
        <ToggleRow
          id="split-shipping"
          label={copy.toggle}
          checked={on}
          onChange={(next) => onChange(next ? DEFAULT_SPLIT : 1)}
        />
        <p className="text-caption text-muted-foreground">{on ? copy.on(maxParcels) : copy.off}</p>
      </div>
    </DataCard>
  )
}
