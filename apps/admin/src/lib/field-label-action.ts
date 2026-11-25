/** SOURCE OF TRUTH: the small button beside a Customize field's label — WHAT: a context that lets a wrapper (the "Connect dynamic source" button) hand FieldFrame a control to draw next to the label / WHY: drawn absolutely it covered long labels; FieldFrame lays it out beside the text instead */
'use client'

import { createContext, type ReactNode, useContext } from 'react'

/** Provide with `<FieldLabelAction value={button}>`; FieldFrame clears it for nested fields. */
export const FieldLabelAction = createContext<ReactNode>(null)

/** The control the nearest wrapper wants beside this field's label, or null. */
export function useFieldLabelAction(): ReactNode {
  return useContext(FieldLabelAction)
}
