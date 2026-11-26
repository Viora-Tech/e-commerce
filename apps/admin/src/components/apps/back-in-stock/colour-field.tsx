'use client'

import { Field, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { useState } from 'react'

type ColourFieldProps = {
  id: string
  label: string
  /** `#rrggbb`. */
  value: string
  onChange: (hex: string) => void
}

const HEX = /^#[0-9a-fA-F]{6}$/

/** A colour: the swatch opens the browser's picker, the box beside it takes a typed hex. */
export default function ColourField({ id, label, value, onChange }: ColourFieldProps) {
  // Hooks
  const [typed, setTyped] = useState<string | null>(null)

  // Event handlers
  const handleTyped = (text: string) => {
    setTyped(text)
    const hex = text.startsWith('#') ? text : `#${text}`
    if (HEX.test(hex)) onChange(hex.toLowerCase())
  }

  // Render logic
  const shown = typed ?? value

  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={label}
          value={value}
          onChange={(e) => {
            setTyped(null)
            onChange(e.target.value)
          }}
          className="size-9 shrink-0 cursor-pointer rounded-md border border-input bg-card p-1"
        />
        <Input
          id={id}
          value={shown}
          maxLength={7}
          onChange={(e) => handleTyped(e.target.value)}
          onBlur={() => setTyped(null)}
          aria-invalid={!HEX.test(shown) || undefined}
          className="font-mono"
        />
      </div>
    </Field>
  )
}
