'use client'

import { stateForPincode } from '@commerce/core/checkout-settings'
import { Field, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
import type { ReactNode } from 'react'
import type { DraftFormState } from '@/components/drafts/draft-form-state'
import { draftEditorContent } from '@/data/drafts'
import { INDIAN_STATES } from '@/data/india'
import { useCopy } from '@/hooks/use-copy'

type Address = DraftFormState['address']

type DraftAddressFieldsProps = {
  /** Keeps the field ids apart when the shipping and billing fields share the page. */
  idPrefix: string
  address: Address
  onChange: (address: Address) => void
  /** Drawn between the name and the address lines (the billing company and GSTIN). */
  afterName?: ReactNode
}

const stateItems = INDIAN_STATES.map((s) => ({ value: s.code, label: s.name }))

/** Name, address lines, city, state, PIN code and phone of one draft address. */
export default function DraftAddressFields({
  idPrefix,
  address,
  onChange,
  afterName,
}: DraftAddressFieldsProps) {
  // Hooks
  const copy = useCopy(draftEditorContent)

  // Helpers
  const set = (key: keyof Address) => (value: string) => onChange({ ...address, [key]: value })
  const id = (key: string) => `${idPrefix}-${key}`

  // Event handlers
  /* A full PIN code that belongs to one state fills the state in (#1028). */
  const handlePincode = (value: string) => {
    const pincode = value.replace(/\D/g, '').slice(0, 6)
    const state = pincode.length === 6 ? stateForPincode(pincode) : null
    onChange({ ...address, pincode, ...(state ? { stateCode: state } : {}) })
  }

  // Render logic
  return (
    <>
      <Field>
        <FieldLabel htmlFor={id('name')}>{copy.address.name}</FieldLabel>
        <Input id={id('name')} value={address.name} onChange={(e) => set('name')(e.target.value)} />
      </Field>
      {afterName}
      <Field>
        <FieldLabel htmlFor={id('line1')}>{copy.address.line1}</FieldLabel>
        <Input
          id={id('line1')}
          value={address.line1}
          onChange={(e) => set('line1')(e.target.value)}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={id('line2')}>{copy.address.line2}</FieldLabel>
        <Input
          id={id('line2')}
          value={address.line2}
          onChange={(e) => set('line2')(e.target.value)}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor={id('city')}>{copy.address.city}</FieldLabel>
          <Input
            id={id('city')}
            value={address.city}
            onChange={(e) => set('city')(e.target.value)}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={id('state')}>{copy.address.state}</FieldLabel>
          <Select
            items={stateItems}
            value={address.stateCode}
            onValueChange={(code) => code && set('stateCode')(String(code))}
          >
            <SelectTrigger id={id('state')} className="w-full">
              <SelectValue placeholder={copy.address.statePlaceholder} />
            </SelectTrigger>
            <SelectContent>
              {stateItems.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>
      <Field>
        <FieldLabel htmlFor={id('pincode')}>{copy.address.pincode}</FieldLabel>
        <Input
          id={id('pincode')}
          inputMode="numeric"
          value={address.pincode}
          onChange={(e) => handlePincode(e.target.value)}
        />
      </Field>
      <Field>
        <FieldLabel htmlFor={id('phone')}>{copy.address.phone}</FieldLabel>
        <Input
          id={id('phone')}
          value={address.phone}
          onChange={(e) => set('phone')(e.target.value)}
        />
      </Field>
    </>
  )
}
