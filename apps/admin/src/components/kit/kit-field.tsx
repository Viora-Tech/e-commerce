import { cn } from '@commerce/ui/lib/utils'
import type { ReactNode } from 'react'

type KitFieldProps = {
  label: string
  htmlFor?: string
  required?: boolean
  /** Helper line under the control, kit 14:1637 style at 14px Neutral/500. */
  help?: string
  error?: string
  children: ReactNode
  className?: string
}

/**
 * Sheet 14:1636 field: 15/400 Cyprus label, 12px gap, then the 48px control
 * (`<Input size="kit" />` / `<Textarea size="kit" />`). Rows of fields sit 20px
 * apart horizontally and 24px apart vertically (14:1633).
 */
export default function KitField({
  label,
  htmlFor,
  required,
  help,
  error,
  children,
  className,
}: KitFieldProps) {
  // Render logic
  return (
    <div className={cn('flex min-w-0 flex-1 flex-col gap-3', className)}>
      <label htmlFor={htmlFor} className="text-kit-field text-ink-strong">
        {label}
        {required ? <span className="ml-1 text-destructive">*</span> : null}
      </label>
      {children}
      {error ? (
        <p className="text-kit-body text-destructive">{error}</p>
      ) : help ? (
        <p className="text-kit-body text-muted-foreground">{help}</p>
      ) : null}
    </div>
  )
}
