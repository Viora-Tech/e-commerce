'use client'

import { FieldText, FieldTextarea } from '@commerce/ui/icons'
import { Input } from '@commerce/ui/shadcn/input'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import FieldFrame from './field-frame'

type CustomizeTextFieldProps = {
  field: { type: 'text' | 'textarea'; label?: string; placeholder?: string }
  value: string | undefined
  onChange: (value: string) => void
  id?: string
  readOnly?: boolean
  name: string
}

/** Puck's `text` and `textarea` field types: one rounded, our-styled input. */
export default function CustomizeTextField({
  field,
  value,
  onChange,
  id,
  readOnly,
  name,
}: CustomizeTextFieldProps) {
  // Render logic
  const label = field.label ?? name
  const multiline = field.type === 'textarea'

  return (
    <FieldFrame icon={multiline ? FieldTextarea : FieldText} label={label}>
      {multiline ? (
        <Textarea
          id={id}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          disabled={readOnly}
          rows={3}
          className="rounded-xl"
        />
      ) : (
        <Input
          id={id}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          disabled={readOnly}
          size="lg"
          className="rounded-xl"
        />
      )}
    </FieldFrame>
  )
}
