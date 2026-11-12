'use client'

import { Input } from '@commerce/ui/shadcn/input'
import ChoiceField from '@/components/apps/gst-invoices/choice-field'
import { bulkShipContent } from '@/data/bulk-ship'
import { createShipmentContent } from '@/data/create-shipment'
import { useCopy, useFormat } from '@/hooks/use-copy'
import {
  CUSTOM_SIZE,
  type EditForm,
  OWN_BOX,
  typedChargedGrams,
  withEditBox,
} from './bulk-edit-state'
import type { BulkLine } from './bulk-ship-state'
import type { ShipmentDraft } from './flow-state'

type BulkEditPackageProps = {
  line: BulkLine
  form: EditForm
  onChange: (form: EditForm) => void
  boxes: ShipmentDraft['boxes']
}

const kg = (grams: number) => Math.round(grams / 10) / 100

/** The Edit popup's left half (Figma 913:9698): the items in this parcel, then its box,
 *  weight and size, and the weight the couriers will charge. */
export default function BulkEditPackage({ line, form, onChange, boxes }: BulkEditPackageProps) {
  // Hooks
  const all = useCopy(bulkShipContent)
  const pkg = useCopy(createShipmentContent.package)
  const fmt = useFormat()

  // Helpers
  const field = (key: 'weight' | 'length' | 'width' | 'height', label: string) => (
    <Input
      aria-label={label}
      inputMode="numeric"
      value={form[key]}
      onChange={(e) =>
        onChange({
          ...form,
          [key]: e.target.value,
          ...(key === 'weight' ? {} : { boxId: CUSTOM_SIZE }),
        })
      }
      className="tabular-nums"
    />
  )

  // Render logic
  const copy = all.editPopup
  const parcel = line.parcel
  const items = parcel?.lines ?? []
  const units = items.reduce((n, l) => n + l.quantity, 0)
  const charged = typedChargedGrams(form)
  const options = [
    ...(parcel?.dimensionsCm ? [{ value: OWN_BOX, label: copy.ownBox }] : []),
    ...boxes.map((b) => ({
      value: b.id,
      label: pkg.boxChosen(b.name, b.lengthCm, b.widthCm, b.heightCm, b.weightGrams),
    })),
    { value: CUSTOM_SIZE, label: copy.customBox },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <p className="text-caption font-medium tracking-wide text-muted-foreground uppercase">
            {copy.items}
          </p>
          <span className="text-caption text-muted-foreground">
            {copy.itemsCount(units, line.order.unitsOrdered)}
          </span>
        </div>
        <ul className="flex flex-col divide-y divide-hairline rounded-lg border border-border">
          {items.map((l) => (
            <li key={l.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-body text-ink-strong">{l.title}</span>
                <span className="text-caption text-muted-foreground">
                  {l.weightGrams === null
                    ? all.weightMissing
                    : pkg.unitWeight(fmt.number(l.weightGrams))}
                </span>
              </span>
              <span className="shrink-0 text-body tabular-nums text-muted-foreground">
                × {l.quantity}
              </span>
            </li>
          ))}
        </ul>
        {units < line.order.unitsOrdered ? (
          <p className="text-caption text-muted-foreground">{copy.partNote}</p>
        ) : null}
      </div>
      <p className="text-caption font-medium tracking-wide text-muted-foreground uppercase">
        {copy.packageFor}
      </p>
      <ChoiceField
        id="bulk-edit-box"
        label={copy.box}
        value={form.boxId}
        options={options}
        onChange={(v) => onChange(withEditBox(form, v, line, boxes))}
      />
      <div className="flex flex-col gap-2">
        <p className="text-body font-medium text-ink-strong">{copy.weightDims}</p>
        <div className="grid grid-cols-[1.6fr_1fr_1fr_1fr] gap-2">
          {field('weight', copy.weight)}
          {field('length', copy.length)}
          {field('width', copy.width)}
          {field('height', copy.height)}
        </div>
      </div>
      {charged !== null ? (
        <p className="rounded-lg bg-muted/60 px-3 py-2.5 text-caption text-muted-foreground">
          {copy.chargedNote(fmt.number(kg(charged)))}
        </p>
      ) : null}
    </div>
  )
}
