import type { ReactNode } from 'react'
import FieldFrame from './field-frame'

type CustomizeRichTextFieldProps = {
  field: { label?: string }
  name: string
  /**
   * The editor Puck already drew: our Lexical editor for a `custom` body field, or Puck's
   * own Tiptap editor (with its B/I/U menu) for a `richtext` field.
   */
  children: ReactNode
}

/** Puck's `custom` and `richtext` field types in the right panel. Frame only. */
export default function CustomizeRichTextField({
  field,
  name,
  children,
}: CustomizeRichTextFieldProps) {
  return (
    <FieldFrame label={field.label ?? name}>
      <div className="overflow-hidden rounded-lg border border-input">{children}</div>
    </FieldFrame>
  )
}
