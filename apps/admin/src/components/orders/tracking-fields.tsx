'use client'

import {
  COURIERS,
  type Courier,
  type CourierId,
  courierById,
  courierMatches,
  detectCourier,
  trackingUrlFor,
} from '@commerce/core/tracking-numbers'
import { Button } from '@commerce/ui/shadcn/button'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@commerce/ui/shadcn/combobox'
import { Field, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { orderDetailContent } from '@/data/order-detail'
import { useCopy } from '@/hooks/use-copy'

export type TrackingDraft = {
  trackingNumber: string
  courierId: CourierId
  /** True once the merchant picked a courier themselves; detection then stops overriding it. */
  picked: boolean
  /** What the merchant typed when the courier is "Other". */
  otherName: string
  /** "Other" courier's own tracking page, typed by the merchant (optional). */
  otherUrl?: string | undefined
}

export const EMPTY_TRACKING: TrackingDraft = {
  trackingNumber: '',
  courierId: 'other',
  picked: false,
  otherName: '',
}

type TrackingFieldsProps = {
  value: TrackingDraft
  onChange: (next: TrackingDraft) => void
}

/** The courier name and tracking link the fulfilment is saved with. */
export function trackingPayload(d: TrackingDraft): {
  courier?: string
  trackingNumber?: string
  trackingUrl?: string
} {
  const trackingNumber = d.trackingNumber.trim()
  const courier = d.courierId === 'other' ? d.otherName.trim() : courierById(d.courierId)?.name
  const typedUrl = d.courierId === 'other' ? (d.otherUrl ?? '').trim() : ''
  /* A typed link is used only when it is a web address (the API refuses anything else). */
  const trackingUrl = /^https?:\/\/\S+$/i.test(typedUrl)
    ? typedUrl
    : trackingNumber
      ? trackingUrlFor(d.courierId, trackingNumber)
      : null
  return {
    ...(courier ? { courier } : {}),
    ...(trackingNumber ? { trackingNumber } : {}),
    ...(trackingUrl ? { trackingUrl } : {}),
  }
}

/**
 * Tracking number first, like Shopify: pasting one picks the courier its
 * format belongs to, and the searchable list is always there to change it.
 */
export default function TrackingFields({ value, onChange }: TrackingFieldsProps) {
  // Hooks
  const copy = useCopy(orderDetailContent)

  // Event handlers
  const handleNumber = (trackingNumber: string) => {
    if (value.picked) {
      onChange({ ...value, trackingNumber })
      return
    }
    const guess = detectCourier(trackingNumber)
    onChange({ ...value, trackingNumber, courierId: guess.courier ?? 'other' })
  }

  const handlePick = (courier: Courier | null) => {
    onChange({ ...value, courierId: courier?.id ?? 'other', picked: true })
  }

  // Render logic
  const c = copy.fulfilDialog
  const guess = detectCourier(value.trackingNumber)
  const selected = courierById(value.courierId)
  const detected = !value.picked && guess.courier ? courierById(guess.courier) : null
  const hints = value.courierId === 'other' ? guess.candidates : []
  const link = value.trackingNumber.trim()
    ? trackingUrlFor(value.courierId, value.trackingNumber)
    : null

  return (
    <div className="flex flex-col gap-4">
      <Field>
        <FieldLabel htmlFor="fulfil-tracking">{c.tracking}</FieldLabel>
        <Input
          id="fulfil-tracking"
          value={value.trackingNumber}
          placeholder={c.trackingPlaceholder}
          autoComplete="off"
          spellCheck={false}
          onChange={(e) => handleNumber(e.target.value)}
        />
        {detected ? <FieldDescription>{c.detected(detected.name)}</FieldDescription> : null}
        {hints.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-caption text-muted-foreground">{c.couldBe}</span>
            {hints.map((id) => (
              <Button
                key={id}
                type="button"
                size="sm"
                variant="outline"
                onClick={() => handlePick(courierById(id))}
              >
                {courierById(id)?.name}
              </Button>
            ))}
          </div>
        ) : null}
      </Field>

      <Field>
        <FieldLabel htmlFor="fulfil-courier">{c.courier}</FieldLabel>
        <Combobox
          items={COURIERS}
          value={selected}
          onValueChange={handlePick}
          itemToStringLabel={(item: Courier) => item.name}
          isItemEqualToValue={(a: Courier, b: Courier) => a.id === b.id}
          filter={courierMatches}
        >
          <ComboboxInput id="fulfil-courier" placeholder={c.courierSearch} className="w-full" />
          <ComboboxContent>
            <ComboboxEmpty>{c.courierNone}</ComboboxEmpty>
            <ComboboxList>
              {(item: Courier) => (
                <ComboboxItem key={item.id} value={item}>
                  {item.name}
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
        {link ? (
          <FieldDescription>
            <a href={link} target="_blank" rel="noreferrer" className="text-link underline">
              {c.openTracking}
            </a>
          </FieldDescription>
        ) : null}
      </Field>

      {value.courierId === 'other' ? (
        <Field>
          <FieldLabel htmlFor="fulfil-courier-name">{c.otherName}</FieldLabel>
          <Input
            id="fulfil-courier-name"
            value={value.otherName}
            maxLength={60}
            placeholder={c.otherNamePlaceholder}
            onChange={(e) => onChange({ ...value, otherName: e.target.value })}
          />
        </Field>
      ) : null}
      {value.courierId === 'other' ? (
        <Field>
          <FieldLabel htmlFor="fulfil-tracking-link">{c.otherUrl}</FieldLabel>
          <Input
            id="fulfil-tracking-link"
            type="url"
            inputMode="url"
            value={value.otherUrl ?? ''}
            maxLength={500}
            placeholder={c.otherUrlPlaceholder}
            onChange={(e) => onChange({ ...value, otherUrl: e.target.value })}
          />
          <FieldDescription>{c.otherUrlHelp}</FieldDescription>
        </Field>
      ) : null}
    </div>
  )
}
