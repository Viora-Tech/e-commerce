import { cn } from '@commerce/ui/lib/utils'
import type { ReactNode } from 'react'

type FieldFrameProps = {
  label: string
  /** Label and control on one row, for small controls (a switch, a short number). */
  inline?: boolean
  htmlFor?: string | undefined
  children: ReactNode
}

const LABEL = 'min-w-0 truncate text-[0.8125rem] leading-[1.1875rem] font-medium text-foreground'

/**
 * The label + control every field-type override in Customize's right panel
 * shares. Puck's own `fieldLabel` is suppressed (`fieldLabel: () => <></>`)
 * so every field is labelled here, once, in the inspector's label style
 * (Figma "Input" 269:4131): 13px medium, sentence case, 6px above the control.
 */
export default function FieldFrame({ label, inline, htmlFor, children }: FieldFrameProps) {
  // Render logic
  return (
    <div
      className={cn(
        'flex min-w-0',
        inline ? 'min-h-8 items-center justify-between gap-3' : 'flex-col gap-1.5',
      )}
    >
      {htmlFor ? (
        <label htmlFor={htmlFor} className={LABEL}>
          {label}
        </label>
      ) : (
        <span className={LABEL}>{label}</span>
      )}
      {children}
    </div>
  )
}
