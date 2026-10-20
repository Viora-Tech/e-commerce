'use client'

import { Field, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import PhoneField from '@/components/fields/phone-field'
import { INDIAN_STATES } from '@/data/india'
import { locationsContent } from '@/data/inventory'
import { useCopy } from '@/hooks/use-copy'

type LocationAddressFieldsProps = {
  draft: LocationDraft
  onChange: (draft: LocationDraft) => void
}

export type LocationDraft = {
  name: string
  line1: string
  city: string
  stateCode: string
  pincode: string
  phone: string
}

export const EMPTY_LOCATION_DRAFT: LocationDraft = {
  name: '',
  line1: '',
  city: '',
  stateCode: '',
  pincode: '',
  phone: '',
}

/** Blank or six digits: the one rule the server would otherwise refuse with a bare 400. */
export const pincodeValid = (draft: LocationDraft) =>
  draft.pincode.trim() === '' || /^\d{6}$/.test(draft.pincode.trim())

/** The API input: blank fields go as undefined on create, as '' (clear) on edit. */
export const locationPayload = (draft: LocationDraft, blank: '' | undefined) => ({
  name: draft.name.trim(),
  line1: draft.line1.trim() || blank,
  city: draft.city.trim() || blank,
  stateCode: draft.stateCode || blank,
  pincode: draft.pincode.trim() || blank,
  phone: draft.phone.trim() || blank,
})

/** The state decides which GST number the location can bill under, so it is picked, not typed. */
const STATE_ITEMS = INDIAN_STATES.map((s) => ({ value: s.code, label: s.name }))

/** Name, address, state and phone of a location: the Add location and Edit location forms. */
export default function LocationAddressFields({ draft, onChange }: LocationAddressFieldsProps) {
  // Hooks
  const copy = useCopy(locationsContent)

  // Render logic
  const fields = [
    { key: 'line1', label: copy.line1, span: true, placeholder: copy.line1Placeholder },
    { key: 'city', label: copy.city, span: false, placeholder: undefined },
    { key: 'pincode', label: copy.pincode, span: false, placeholder: undefined },
  ] as const

  return (
    <div className="grid grid-cols-2 gap-4">
      <Field className="col-span-2">
        <FieldLabel htmlFor="location-name">{copy.name}</FieldLabel>
        <Input
          id="location-name"
          value={draft.name}
          placeholder={copy.namePlaceholder}
          autoComplete="off"
          maxLength={80}
          onChange={(e) => onChange({ ...draft, name: e.target.value })}
        />
      </Field>
      {fields.map((f) => (
        <Field key={f.key} className={f.span ? 'col-span-2' : undefined}>
          <FieldLabel htmlFor={`location-${f.key}`}>{f.label}</FieldLabel>
          <Input
            id={`location-${f.key}`}
            value={draft[f.key]}
            placeholder={f.placeholder}
            inputMode={f.key === 'pincode' ? 'numeric' : undefined}
            onChange={(e) => onChange({ ...draft, [f.key]: e.target.value })}
          />
        </Field>
      ))}
      <Field className="col-span-2">
        <FieldLabel htmlFor="location-state">{copy.stateCode}</FieldLabel>
        <Select
          items={STATE_ITEMS}
          value={draft.stateCode || null}
          onValueChange={(code) => code && onChange({ ...draft, stateCode: String(code) })}
        >
          <SelectTrigger id="location-state" className="w-full">
            <SelectValue placeholder={copy.statePlaceholder} />
          </SelectTrigger>
          <SelectContent>
            {STATE_ITEMS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <div className="col-span-2">
        <PhoneField
          id="location-phone"
          label={copy.phone}
          value={draft.phone}
          onChange={(phone) => onChange({ ...draft, phone })}
        />
      </div>
    </div>
  )
}
