'use client'

import { cn } from '@commerce/ui/lib/utils'
import { ToggleGroup, ToggleGroupItem } from '@commerce/ui/shadcn/toggle-group'
import { type PaymentModeId, paymentModesContent } from '@/data/payment-modes'
import { useCopy } from '@/hooks/use-copy'
import { keySetStatus, MODE_ORDER, type ModeKeys } from './mode-switch'

type PaymentModeControlProps = {
  /** Prefixes the label id. */
  id: string
  label: string
  /** The highlighted segment. */
  value: PaymentModeId | null
  /** The key set checkout uses now. */
  active: PaymentModeId | null
  keys: ModeKeys
  onChange: (mode: PaymentModeId) => void
  disabled?: boolean
}

/** The dot inside a segment: filled when that set is saved, a ring when it is missing. */
const DOT = {
  'in-use': { live: 'bg-success', test: 'bg-warning' },
  saved: { live: 'bg-muted-foreground', test: 'bg-muted-foreground' },
  missing: { live: 'border border-muted-foreground', test: 'border border-muted-foreground' },
} as const

/**
 * The one "Live | Test" segmented control for every payment gateway (the cards' switch, the
 * Connect pages' key picker). Each segment says whether its keys are saved; Test pressed is amber.
 */
export default function PaymentModeControl({
  id,
  label,
  value,
  active,
  keys,
  onChange,
  disabled = false,
}: PaymentModeControlProps) {
  // Hooks
  const { mode: copy } = useCopy(paymentModesContent)

  // Event handlers
  const handleChange = (next: string[]) => {
    const picked = next[0]
    if (picked === 'live' || picked === 'test') onChange(picked)
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span id={`${id}-mode-label`} className="text-body font-medium text-foreground">
        {label}
      </span>
      <ToggleGroup
        aria-labelledby={`${id}-mode-label`}
        value={value ? [value] : []}
        onValueChange={handleChange}
        variant="outline"
        spacing={0}
        disabled={disabled}
      >
        {MODE_ORDER.map((mode) => {
          const status = keySetStatus(mode, active, keys)
          return (
            <ToggleGroupItem
              key={mode}
              value={mode}
              aria-label={`${copy[mode]} · ${copy.status[status]}`}
              className={cn(
                'gap-2 px-4',
                mode === 'test'
                  ? 'aria-pressed:bg-warning-soft aria-pressed:text-foreground'
                  : 'aria-pressed:bg-success-soft aria-pressed:text-foreground',
              )}
            >
              <span aria-hidden="true" className={cn('size-2 rounded-full', DOT[status][mode])} />
              {copy[mode]}
            </ToggleGroupItem>
          )
        })}
      </ToggleGroup>
    </div>
  )
}
