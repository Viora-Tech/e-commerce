'use client'

import { Input } from '@commerce/ui/shadcn/input'
import { Textarea } from '@commerce/ui/shadcn/textarea'
import { FIELD_INPUT, FIELD_TEXTAREA } from '@/lib/customize-field-styles'
import { isLinkTextField } from '@/lib/customize-links'
import FieldFrame from './field-frame'
import LinkPicker from './link-picker'
import ProductHandleField from './product-handle-field'

type CustomizeTextFieldProps = {
  field: { type: 'text' | 'textarea'; label?: string; placeholder?: string }
  value: string | undefined
  onChange: (value: string) => void
  id?: string
  readOnly?: boolean
  /** Puck passes it from the sidebar form; `AutoField` (fields inside a Group, Columns …) does not. */
  name?: string | undefined
}

/**
 * Puck's `text` and `textarea` field types: one rounded, our-styled input —
 * or, for a link (`href`, or a field labelled "Link"), the link picker.
 */
export default function CustomizeTextField({
  field,
  value,
  onChange,
  id,
  readOnly,
  name = '',
}: CustomizeTextFieldProps) {
  // Early returns
  const label = field.label ?? name
  if (isLinkTextField(field, name)) {
    return (
      <FieldFrame label={label} htmlFor={id}>
        <LinkPicker id={id} value={value} onChange={onChange} readOnly={readOnly} />
      </FieldFrame>
    )
  }

  // The Product card element stores a product handle: pick it from the catalogue.
  if (field.type === 'text' && name.split('.').pop() === 'productHandle') {
    return (
      <FieldFrame label={label} htmlFor={id}>
        <ProductHandleField id={id} value={value} onChange={onChange} readOnly={readOnly} />
      </FieldFrame>
    )
  }

  // Render logic
  const multiline = field.type === 'textarea'

  return (
    <FieldFrame label={label} htmlFor={id}>
      {multiline ? (
        <Textarea
          id={id}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          disabled={readOnly}
          rows={3}
          className={FIELD_TEXTAREA}
        />
      ) : (
        <Input
          id={id}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          disabled={readOnly}
          size="lg"
          className={FIELD_INPUT}
        />
      )}
    </FieldFrame>
  )
}
