import type { RichTextValue } from '@commerce/richtext'
import type { CustomField } from '@puckeditor/core'
import type { ComponentType } from 'react'

/** A field editor the host supplies (admin passes the Lexical editor). */
export type RichTextFieldEditor = ComponentType<{
  value: RichTextValue | null | undefined
  onChange: (value: RichTextValue) => void
  placeholder?: string | undefined
}>

/** A rich-text Puck field drawn by the host's editor; a read-only textarea without one. */
export function richTextField(
  Editor: RichTextFieldEditor | undefined,
  label = 'Body',
): CustomField<RichTextValue | string> {
  return {
    type: 'custom',
    label,
    render: ({ value, onChange }) =>
      Editor ? (
        <Editor
          value={typeof value === 'string' ? null : value}
          onChange={onChange}
          placeholder="Write the section text…"
        />
      ) : (
        <textarea readOnly value={typeof value === 'string' ? value : JSON.stringify(value)} />
      ),
  }
}
