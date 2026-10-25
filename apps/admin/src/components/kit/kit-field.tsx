import { cn } from '@commerce/ui/lib/utils'
import type { ReactNode } from 'react'
import RequiredMark from '@/components/fields/required-mark'

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
 * Form field (Saleor rhythm): 13/500 label, 6px gap, the 36px control
 * (`<Input size="kit" />` / `<Textarea size="kit" />`), then a 12px help or error line.
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
    <div className={cn('flex min-w-0 flex-1 flex-col gap-1.5', className)}>
      <label htmlFor={htmlFor} className="text-body-strong text-foreground">
        {label}
        {required ? (
          <>
            {' '}
            <RequiredMark />
          </>
        ) : null}
      </label>
      {children}
      {error ? (
        <p className="text-caption font-normal text-destructive">{error}</p>
      ) : help ? (
        <p className="text-caption font-normal leading-relaxed text-muted-foreground">{help}</p>
      ) : null}
    </div>
  )
}
