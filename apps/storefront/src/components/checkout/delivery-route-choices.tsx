'use client'

import { useFormatPaise } from '@commerce/blocks'
import RadioDot from '@/components/checkout/radio-dot'
import { checkoutContent as content } from '@/data/checkout'
import type { DeliveryChoiceCard } from '@/lib/delivery-options'

type DeliveryRouteChoicesProps = {
  optionId: string
  choices: DeliveryChoiceCard[]
  /** The picked sub-choice; null is the first (the rule's default). */
  selected: string | null
  onSelect: (routeKey: string | null) => void
}

/**
 * The couriers a product rule lets the shopper pick between under one option ("Express ·
 * Delhivery, or Blue Dart Air"), each with its own date and price. The first is the rule's
 * default and is picked until the shopper picks another.
 */
export default function DeliveryRouteChoices({
  optionId,
  choices,
  selected,
  onSelect,
}: DeliveryRouteChoicesProps) {
  // Hooks
  const money = useFormatPaise()

  // Render logic
  const picked = selected ?? choices[0]?.routeKey ?? null

  return (
    <fieldset className="ml-7 flex flex-col gap-1.5 border-0! p-0! sm:ml-8">
      <legend className="sr-only">{content.deliveryMethod}</legend>
      {choices.map((c, i) => {
        const checked = picked === c.routeKey
        return (
          <label
            key={c.routeKey}
            className="flex cursor-pointer items-center gap-2.5 rounded-ck px-2 py-1.5 text-[0.8125rem] text-ck-ink has-[:focus-visible]:[box-shadow:0_0_0_3px_var(--ck-ring)]"
          >
            <input
              type="radio"
              name={`delivery-route-${optionId}`}
              value={c.routeKey}
              checked={checked}
              onChange={() => onSelect(i === 0 ? null : c.routeKey)}
              className="peer sr-only"
            />
            <RadioDot checked={checked} />
            <span className="flex-1 font-medium">{c.label}</span>
            {c.arrives ? <span className="text-ck-muted">{c.arrives}</span> : null}
            <span className="tabular-nums">
              {c.pricePaise === 0 ? content.shippingFree : money(c.pricePaise)}
            </span>
          </label>
        )
      })}
    </fieldset>
  )
}
