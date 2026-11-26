'use client'

import { cn } from '@commerce/ui/lib/utils'
import type { ReactNode } from 'react'
import { FieldLabelAction, useFieldLabelAction } from '@/lib/field-label-action'

type FieldFrameProps = {
  label: string
  /** Label and control on one row, for small controls (a switch, a short number). */
  inline?: boolean
  htmlFor?: string | undefined
  children: ReactNode
}

const LABEL = 'min-w-0 text-caption leading-[1.1875rem] font-medium text-foreground wrap-break-word'

/**
 * The label + control every field-type override in Customize's right panel
 * shares. Puck's own `fieldLabel` is suppressed (`fieldLabel: () => <></>`)
 * so every field is labelled here, once, in the inspector's label style
 * (Figma "Input" 269:4131): 13px medium, sentence case, 6px above the control.
 * A long label wraps instead of being cut. A small button that belongs to the label (the
 * "Connect dynamic source" button, `FieldLabelAction`) sits beside it, never over it.
 */
export default function FieldFrame({ label, inline, htmlFor, children }: FieldFrameProps) {
  // Hooks
  const action = useFieldLabelAction()

  // Render logic
  const text = htmlFor ? (
    <label htmlFor={htmlFor} className={cn(LABEL, 'flex-1')}>
      {label}
    </label>
  ) : (
    <span className={cn(LABEL, 'flex-1')}>{label}</span>
  )
  return (
    <div
      className={cn(
        'flex min-w-0',
        inline ? 'min-h-8 items-center justify-between gap-3' : 'flex-col gap-1.5',
      )}
    >
      {action ? (
        <div className="flex min-w-0 flex-1 items-start gap-1">
          {text}
          <span className="-my-0.5 shrink-0">{action}</span>
        </div>
      ) : (
        text
      )}
      {/* The action is for this field's label only, not for any field drawn inside it. */}
      <FieldLabelAction value={null}>{children}</FieldLabelAction>
    </div>
  )
}
