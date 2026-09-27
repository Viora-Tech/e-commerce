import { cn } from '@commerce/ui/lib/utils'
import type { ReactNode } from 'react'

type FieldFrameProps = {
  label: string
  /** Label and control on one row, for small controls (a switch, a short number). */
  inline?: boolean
  htmlFor?: string | undefined
  children: ReactNode
}

const LABEL = 'min-w-0 truncate text-xs font-medium text-muted-foreground'

/**
 * The label + control every field-type override in Customize's right panel
 * shares. Puck's own `fieldLabel` is suppressed (`fieldLabel: () => <></>`)
 * so every field is labelled here, once, in the panel's one quiet label
 * style: 12px medium, muted, sentence case — the control carries the weight.
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
