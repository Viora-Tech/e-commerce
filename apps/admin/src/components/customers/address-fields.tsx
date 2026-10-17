'use client'

import { isPincode } from '@commerce/core/account-patterns'
import { Field, FieldDescription, FieldError, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import { useRef, useState, useTransition } from 'react'
import { addressFormContent as copy } from '@/data/customers'
import { INDIAN_STATES, stateName } from '@/data/india'
import { api } from '@/lib/api-client'

export type AddressValue = {
  line1: string
  line2: string
  city: string
  stateCode: string
  pincode: string
}

export const EMPTY_ADDRESS: AddressValue = {
  line1: '',
  line2: '',
  city: '',
  stateCode: '',
  pincode: '',
}

type AddressFieldsProps = {
  /** Keeps the field ids unique when two forms share a page. */
  idPrefix: string
  value: AddressValue
  onChange: (next: AddressValue) => void
  /** Messages from the server by field (`line1`, `pincode`, …). */
  errors?: Record<string, string> | undefined
}

const stateItems = INDIAN_STATES.map((s) => ({ value: s.code, label: s.name }))
/**
 * Address lines, PIN code, city and state. A full PIN code fills city and
 * state from the same directory checkout's "PIN code first" uses; both stay
 * editable. Without the directory installed, nothing is filled and nothing breaks.
 */
export default function AddressFields({ idPrefix, value, onChange, errors }: AddressFieldsProps) {
  // Hooks
  const [finding, startFind] = useTransition()
  const [found, setFound] = useState<string | null>(null)
  const latest = useRef('')

  // Helpers
  const set = (key: keyof AddressValue) => (v: string) => onChange({ ...value, [key]: v })
  const id = (key: string) => `${idPrefix}-${key}`

  // Event handlers
  const handlePincode = (raw: string) => {
    const pincode = raw.replace(/\D/g, '').slice(0, 6)
    latest.current = pincode
    setFound(null)
    onChange({ ...value, pincode })
    if (!isPincode(pincode)) return
    startFind(async () => {
      const place = await api.customers.lookupPincode({ pincode }).catch(() => null)
      // A slower answer for a PIN code that has since changed is dropped.
      if (!place || latest.current !== pincode) return
      setFound(copy.found(place.city, stateName(place.stateCode)))
      onChange({ ...value, pincode, city: place.city, stateCode: place.stateCode })
    })
  }

  // Render logic
  const hint = finding ? copy.finding : found

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field className="sm:col-span-2" data-invalid={Boolean(errors?.line1)}>
        <FieldLabel htmlFor={id('line1')}>{copy.line1}</FieldLabel>
        <Input
          id={id('line1')}
          autoComplete="address-line1"
          placeholder={copy.line1Placeholder}
          value={value.line1}
          onChange={(e) => set('line1')(e.target.value)}
        />
        {errors?.line1 ? <FieldError>{errors.line1}</FieldError> : null}
      </Field>
      <Field className="sm:col-span-2">
        <FieldLabel htmlFor={id('line2')}>{copy.line2}</FieldLabel>
        <Input
          id={id('line2')}
          autoComplete="address-line2"
          placeholder={copy.line2Placeholder}
          value={value.line2}
          onChange={(e) => set('line2')(e.target.value)}
        />
      </Field>
      <Field className="sm:col-span-2" data-invalid={Boolean(errors?.pincode)}>
        <FieldLabel htmlFor={id('pincode')}>{copy.pincode}</FieldLabel>
        <Input
          id={id('pincode')}
          inputMode="numeric"
          autoComplete="postal-code"
          maxLength={6}
          className="sm:max-w-40"
          value={value.pincode}
          onChange={(e) => handlePincode(e.target.value)}
        />
        {hint ? <FieldDescription>{hint}</FieldDescription> : null}
        {errors?.pincode ? <FieldError>{errors.pincode}</FieldError> : null}
      </Field>
      <Field data-invalid={Boolean(errors?.city)}>
        <FieldLabel htmlFor={id('city')}>{copy.city}</FieldLabel>
        <Input
          id={id('city')}
          autoComplete="address-level2"
          value={value.city}
          onChange={(e) => set('city')(e.target.value)}
        />
        {errors?.city ? <FieldError>{errors.city}</FieldError> : null}
      </Field>
      <Field data-invalid={Boolean(errors?.stateCode)}>
        <FieldLabel htmlFor={id('state')}>{copy.state}</FieldLabel>
        <Select
          items={stateItems}
          value={value.stateCode || null}
          onValueChange={(code) => code && set('stateCode')(String(code))}
        >
          <SelectTrigger id={id('state')} className="w-full">
            <SelectValue placeholder={copy.statePlaceholder} />
          </SelectTrigger>
          <SelectContent>
            {stateItems.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors?.stateCode ? <FieldError>{errors.stateCode}</FieldError> : null}
      </Field>
    </div>
  )
}
