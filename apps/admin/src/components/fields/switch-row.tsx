'use client'

import { cn } from '@commerce/ui/lib/utils'
import { Switch } from '@commerce/ui/shadcn/switch'
import { type ReactNode, useId } from 'react'

type SwitchRowProps = {
  /** The switch's id; one is made when the row needs no fixed id. */
  id?: string | undefined
  label: ReactNode
  /** The help under the label. */
  description?: ReactNode
  checked: boolean
  onChange: (on: boolean) => void
  disabled?: boolean | undefined
  /** Extra content under the help (a link, a note, the tax a price carries). */
  children?: ReactNode
  /** The label's weight: settings lists use semibold, forms medium, dense panels normal. */
  weight?: 'semibold' | 'medium' | 'normal' | undefined
  /** A hairline between rows of a settings list (none above the first, none under the last). */
  divided?: boolean | undefined
  className?: string | undefined
}

/** The label's weight classes. */
const WEIGHT = {
  semibold: 'font-semibold text-ink-strong',
  medium: 'font-medium text-ink-strong',
  normal: 'font-normal text-foreground',
} as const

/**
 * The one on/off row of the admin (owner, 22 Nov 2026: one component, reused everywhere): label
 * and help on the left, the switch on the right. A row with help lines up at the top, a bare
 * label sits centred beside its switch.
 */
export default function SwitchRow({
  id,
  label,
  description,
  checked,
  onChange,
  disabled,
  children,
  weight = 'medium',
  divided = false,
  className,
}: SwitchRowProps) {
  // Hooks
  const madeId = useId()

  // Derived values
  const switchId = id ?? madeId
  const tall = description != null || children != null

  // Render logic
  return (
    <div
      className={cn(
        'flex justify-between gap-4',
        tall ? 'items-start' : 'items-center',
        divided && 'border-b border-hairline py-5 first:pt-0 last:border-b-0 last:pb-0',
        className,
      )}
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <label
          htmlFor={switchId}
          className={cn('flex items-center gap-2 text-body leading-5', WEIGHT[weight])}
        >
          {label}
        </label>
        {description != null ? (
          <div className="text-caption font-normal text-muted-foreground">{description}</div>
        ) : null}
        {children}
      </div>
      <Switch
        id={switchId}
        checked={checked}
        onCheckedChange={(v) => onChange(Boolean(v))}
        disabled={disabled}
        className={tall ? 'mt-0.5 shrink-0' : 'shrink-0'}
      />
    </div>
  )
}
