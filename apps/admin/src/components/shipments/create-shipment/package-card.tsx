'use client'

import CountBadge from '@/components/layout/count-badge'
import DataCard from '@/components/layout/data-card'
import { createShipmentContent } from '@/data/create-shipment'
import { useCopy } from '@/hooks/use-copy'
import type { DraftOrder, DraftParcel, PackageForm, ShipmentDraft } from './flow-state'
import PackageStep from './package-step'
import PartialPicker from './partial-picker'
import type { useSplitPlan } from './use-split-plan'

type PackageCardProps = {
  draft: ShipmentDraft
  order: DraftOrder
  /** The parcel as staff opened it; the picker decides what of it ships now. */
  parcel: DraftParcel
  form: PackageForm
  onChange: (form: PackageForm) => void
  onParcelChange: (parcelId: string) => void
  partial: ReturnType<typeof useSplitPlan>
  chargedGrams?: number | undefined
}

/**
 * Create shipment's Package card (Figma 916:10179): the items with what ships now (the partial
 * picker), then the box, weight and payment of the parcel as it ships now.
 */
export default function PackageCard({
  draft,
  order,
  parcel,
  form,
  onChange,
  onParcelChange,
  partial,
  chargedGrams,
}: PackageCardProps) {
  // Hooks
  const content = useCopy(createShipmentContent)

  // Render logic
  const shown = partial.shown(parcel)
  const units = shown.lines.reduce((n, l) => n + l.quantity, 0)

  return (
    <DataCard
      title={
        <span className="flex items-center gap-2">
          {content.page.package}
          <CountBadge n={content.package.itemCount(units)} tone="outline" />
        </span>
      }
    >
      <PartialPicker
        parcelId={parcel.id}
        lines={parcel.lines}
        plan={partial.plan}
        onPlan={(next) => {
          const updated = partial.change(next, parcel, form)
          if (updated) onChange(updated)
        }}
        parts={order.parcels.length + 1}
      />
      <PackageStep
        draft={draft}
        order={order}
        parcel={shown}
        form={form}
        onChange={onChange}
        onParcelChange={onParcelChange}
        inCard
        chargedGrams={chargedGrams}
      />
    </DataCard>
  )
}
