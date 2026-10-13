'use client'

import { Field, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import ChoiceField from '@/components/apps/gst-invoices/choice-field'
import PillTabs from '@/components/layout/pill-tabs'
import { createShipmentContent } from '@/data/create-shipment'
import { useCopy } from '@/hooks/use-copy'
import {
  CUSTOM_BOX,
  type DraftOrder,
  type DraftParcel,
  type PackageForm,
  PRODUCT_BOX,
  type ShipmentDraft,
  withBox,
} from './flow-state'

type PackageStepProps = {
  draft: ShipmentDraft
  order: DraftOrder
  parcel: DraftParcel
  form: PackageForm
  onChange: (form: PackageForm) => void
  onParcelChange: (parcelId: string) => void
}

/** Select's value for Settings › Shipping's address, which has no location id. */
const STORE_ADDRESS = 'store'

/** Step 1: which parcel, where it is collected from, the box and weight, and how it is paid. */
export default function PackageStep({
  draft,
  order,
  parcel,
  form,
  onChange,
  onParcelChange,
}: PackageStepProps) {
  // Hooks
  const copy = useCopy(createShipmentContent.package)

  // Helpers
  const set = (patch: Partial<PackageForm>) => onChange({ ...form, ...patch })

  // Event handlers
  const handlePickup = (value: string) =>
    set({ pickupLocationId: value === STORE_ADDRESS ? null : value })
  const handleBox = (boxId: string) => onChange(withBox(form, boxId, parcel, draft.boxes))
  const handleSize = (key: 'length' | 'width' | 'height', value: string) =>
    set({ [key]: value, boxId: CUSTOM_BOX })

  // Render logic
  const units = parcel.lines.reduce((n, l) => n + l.quantity, 0)
  const pickupOptions = draft.pickupPlaces.map((p) => ({
    value: p.id ?? STORE_ADDRESS,
    label: p.id
      ? copy.place(p.name, p.city, p.pincode)
      : copy.storeAddress(copy.place(p.name, p.city, p.pincode)),
  }))
  const boxOptions = [
    ...(parcel.dimensionsCm ? [{ value: PRODUCT_BOX, label: copy.productBox }] : []),
    ...draft.boxes.map((b) => ({
      value: b.id,
      label: copy.boxLabel(b.name, b.lengthCm, b.widthCm, b.heightCm),
    })),
    { value: CUSTOM_BOX, label: copy.customBox },
  ]

  return (
    <div className="flex flex-col gap-5">
      {order.parcels.length > 1 ? (
        <div className="flex flex-col gap-2">
          <p className="text-body font-medium text-ink-strong">{copy.parcel}</p>
          <PillTabs<string>
            variant="segmented"
            value={parcel.id ?? ''}
            onChange={onParcelChange}
            tabs={order.parcels.map((p) => ({
              value: p.id ?? '',
              label: copy.parcelName(p.position, p.locationName),
            }))}
          />
          <p className="text-caption text-muted-foreground">{copy.parcelHelp}</p>
        </div>
      ) : null}

      <section className="flex flex-col gap-2 rounded-lg border border-hairline bg-muted/40 p-3">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-body font-medium text-ink-strong">{copy.items}</p>
          <p className="text-caption text-muted-foreground">{copy.itemCount(units)}</p>
        </div>
        <ul className="flex flex-col gap-1 text-body">
          {parcel.lines.map((l) => (
            <li key={l.id} className="flex justify-between gap-3">
              <span className="min-w-0 truncate">{l.title}</span>
              <span className="shrink-0 tabular-nums text-muted-foreground">× {l.quantity}</span>
            </li>
          ))}
        </ul>
      </section>

      <ChoiceField
        id="ship-pickup"
        label={copy.pickup}
        help={copy.pickupHelp}
        value={form.pickupLocationId ?? STORE_ADDRESS}
        options={pickupOptions}
        onChange={handlePickup}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <ChoiceField
          id="ship-box"
          label={copy.box}
          value={form.boxId}
          options={boxOptions}
          onChange={handleBox}
        />
        <Field>
          <FieldLabel htmlFor="ship-weight">{copy.weight}</FieldLabel>
          <Input
            id="ship-weight"
            size="lg"
            type="number"
            inputMode="numeric"
            min={1}
            value={form.weightGrams}
            onChange={(e) => set({ weightGrams: e.target.value })}
          />
          <FieldDescription>{copy.weightHelp}</FieldDescription>
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {(['length', 'width', 'height'] as const).map((key) => (
          <Field key={key}>
            <FieldLabel htmlFor={`ship-${key}`}>{copy[key]}</FieldLabel>
            <Input
              id={`ship-${key}`}
              size="lg"
              type="number"
              inputMode="decimal"
              min={1}
              value={form[key]}
              onChange={(e) => handleSize(key, e.target.value)}
            />
          </Field>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-body font-medium text-ink-strong">{copy.payment}</p>
        <PillTabs<'prepaid' | 'cod'>
          variant="segmented"
          value={form.paymentMode}
          onChange={(paymentMode) => set({ paymentMode })}
          tabs={[
            { value: 'prepaid', label: copy.prepaid },
            { value: 'cod', label: copy.cod },
          ]}
        />
      </div>
      {form.paymentMode === 'cod' ? (
        <Field>
          <FieldLabel htmlFor="ship-cod">{copy.codAmount}</FieldLabel>
          <Input
            id="ship-cod"
            size="lg"
            inputMode="decimal"
            value={form.codAmount}
            onChange={(e) => set({ codAmount: e.target.value })}
          />
          <FieldDescription>{copy.codHelp}</FieldDescription>
        </Field>
      ) : null}
    </div>
  )
}
