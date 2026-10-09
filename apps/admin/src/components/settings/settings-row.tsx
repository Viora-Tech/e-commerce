import { cn } from '@commerce/ui/lib/utils'
import type { ReactNode } from 'react'

type SettingsRowProps = {
  label: string
  description?: string | undefined
  /** The id of the control, so the label is clickable. */
  htmlFor?: string
  /** Shown under the control in the danger colour. */
  error?: string | undefined
  children: ReactNode
  className?: string
}

/**
 * One settings row (Proofly): the label and its plain-words help on the left, the control on the
 * right, a hairline under every row but the last. Stacks on phones.
 */
export default function SettingsRow({
  label,
  description,
  htmlFor,
  error,
  children,
  className,
}: SettingsRowProps) {
  return (
    <div
      className={cn(
        'grid gap-2 border-b border-hairline py-5 first:pt-0 last:border-b-0 last:pb-0 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] md:gap-8',
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <label htmlFor={htmlFor} className="text-body font-semibold text-ink-strong">
          {label}
        </label>
        {description ? (
          <p className="text-caption font-normal text-muted-foreground">{description}</p>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-col gap-1.5">
        {children}
        {error ? <p className="text-caption text-danger">{error}</p> : null}
      </div>
    </div>
  )
}
