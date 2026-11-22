'use client'

import { AutoField, type Field } from '@puckeditor/core'
import { useEffect, useRef, useState } from 'react'

type StableAutoFieldProps = {
  field: Field
  value: unknown
  readOnly?: boolean | undefined
  onChange: (value: unknown) => void
}

/**
 * Puck's public `AutoField` for a sub-field (an array card's field, an object's sub-field), with
 * an `onChange` that keeps one identity for the field's life and always calls the latest prop.
 * Puck's rich text editor re-sends its last edit from an effect whenever `onChange` changes
 * (`useSyncedEditor`), so the new arrow a list hands each render made every edit re-send,
 * re-render and re-send again: React error #185 after typing in an accordion body.
 */
export default function StableAutoField({
  field,
  value,
  readOnly,
  onChange,
}: StableAutoFieldProps) {
  // Hooks
  const [handleChange] = useState(() => (next: unknown) => latest.current(next))
  const latest = useRef(onChange)
  useEffect(() => {
    latest.current = onChange
  })

  return <AutoField field={field} value={value} readOnly={readOnly} onChange={handleChange} />
}
