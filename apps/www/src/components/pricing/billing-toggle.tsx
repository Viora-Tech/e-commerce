'use client'

import { cn } from '@commerce/ui/lib/utils'
import { pricingContent } from '@/data/pricing'

export type Billing = 'monthly' | 'yearly'

type BillingToggleProps = { value: Billing; onChange: (value: Billing) => void }

const copy = pricingContent.page

export default function BillingToggle({ value, onChange }: BillingToggleProps) {
  const options: { key: Billing; label: string }[] = [
    { key: 'monthly', label: copy.monthly },
    { key: 'yearly', label: copy.yearly },
  ]

  return (
    <fieldset
      aria-label={copy.billingLabel}
      className="surface-glass m-0 inline-flex min-w-0 rounded-full border-0 p-1"
    >
      {options.map((option) => {
        const selected = value === option.key
        return (
          <button
            key={option.key}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option.key)}
            className={cn(
              'inline-flex h-9 items-center gap-2 rounded-full px-4 text-sm font-semibold outline-none transition-colors duration-(--duration-press) ease-out focus-visible:ring-3 focus-visible:ring-ring/50',
              selected
                ? 'bg-foreground text-background'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {option.label}
            {option.key === 'yearly' ? (
              <span
                className={cn(
                  'rounded-full px-2 py-0.5 text-xs',
                  selected ? 'bg-background/15 text-background' : 'bg-muted text-foreground',
                )}
              >
                {copy.save}
              </span>
            ) : null}
          </button>
        )
      })}
    </fieldset>
  )
}
