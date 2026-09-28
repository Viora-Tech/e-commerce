'use client'

import { Field, FieldDescription, FieldLabel } from '@commerce/ui/shadcn/field'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from '@commerce/ui/shadcn/input-group'
import { useState } from 'react'
import { checkoutSettingsContent as copy } from '@/data/checkout-settings'

type RupeeInputProps = {
  id: string
  label: string
  hint: string
  /** Stored value, in paise. */
  paise: number
  onChange: (paise: number) => void
}

const toText = (paise: number): string => (paise > 0 ? String(paise / 100) : '0')

/** A whole-rupee amount the merchant types; stored as paise, never negative. */
const toPaise = (text: string): number => {
  const n = Number(text)
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0
}

/** One rupee amount with a ₹ prefix and a plain hint. */
export default function RupeeInput({ id, label, hint, paise, onChange }: RupeeInputProps) {
  // Hooks
  const [text, setText] = useState(toText(paise))

  // Event handlers
  const handleChange = (next: string) => {
    setText(next)
    onChange(toPaise(next))
  }

  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <InputGroup className="max-w-60">
        <InputGroupAddon>
          <InputGroupText>{copy.rupees}</InputGroupText>
        </InputGroupAddon>
        <InputGroupInput
          id={id}
          type="number"
          inputMode="decimal"
          min="0"
          step="1"
          value={text}
          onChange={(e) => handleChange(e.target.value)}
          onBlur={() => setText(toText(paise))}
        />
      </InputGroup>
      <FieldDescription>{hint}</FieldDescription>
    </Field>
  )
}
