import { FieldRichText } from '@commerce/ui/icons'
import type { ReactNode } from 'react'
import FieldFrame from './field-frame'

type CustomizeRichTextFieldProps = {
  field: { label?: string }
  name: string
  /** Our Lexical editor — the `custom` field's own `render()`, already invoked by Puck. */
  children: ReactNode
}

/** Puck's `custom` field type — in this app, always our Lexical rich-text body field. Frame only. */
export default function CustomizeRichTextField({
  field,
  name,
  children,
}: CustomizeRichTextFieldProps) {
  return (
    <FieldFrame icon={FieldRichText} label={field.label ?? name}>
      <div className="overflow-hidden rounded-xl border border-input">{children}</div>
    </FieldFrame>
  )
}
