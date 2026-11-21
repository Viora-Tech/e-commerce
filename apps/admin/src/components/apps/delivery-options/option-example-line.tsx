'use client'

import type { DeliveryOption } from '@commerce/core/delivery-options'
import { cn } from '@commerce/ui/lib/utils'
import { deliveryOptionSectionsContent } from '@/data/delivery-option-sections'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { EXAMPLE_COSTS, type ExampleCard, optionExample } from './option-example'

type OptionExampleLineProps = {
  option: Pick<DeliveryOption, 'name' | 'price' | 'couriers' | 'speed' | 'strategy'>
  className?: string
}

/**
 * "At checkout, for example: Delhivery Surface ₹49 · Delhivery Air + ₹29" (owner, 21 Nov 2026):
 * one live line under an option's price settings, from made-up courier costs, so a change to
 * the price, rounding or faster couriers shows straight away. Try a PIN shows real prices.
 */
export default function OptionExampleLine({ option, className }: OptionExampleLineProps) {
  // Hooks
  const copy = useCopy(deliveryOptionSectionsContent)
  const fmt = useFormat()

  // Helpers
  const label = (c: ExampleCard) =>
    option.couriers.showNames
      ? `${copy.example.carrier} ${copy.example.speeds[c.speed]}`
      : option.name
  const price = (c: ExampleCard) => {
    if (c.extraPaise !== null) return copy.example.extra(fmt.money(c.extraPaise))
    if (c.pricePaise === null) return copy.example.zone
    return c.pricePaise === 0 ? copy.example.free : fmt.money(c.pricePaise)
  }

  // Render logic
  const t = copy.example
  const example = optionExample(option)
  const free = example.freeAbovePaise

  return (
    <section
      aria-live="polite"
      aria-label={t.title}
      className={cn(
        'flex flex-col gap-1 rounded-lg border border-info/30 bg-info-soft px-3 py-2.5',
        className,
      )}
    >
      <span className="text-caption font-medium text-info">{t.title}</span>
      <span className="text-body text-ink-strong">
        {example.cards.map((c, i) => (
          <span key={c.speed}>
            {i > 0 ? <span className="text-muted-foreground"> · </span> : null}
            {label(c)} <span className="font-semibold tabular-nums">{price(c)}</span>
          </span>
        ))}
        {free != null ? (
          <span className="text-muted-foreground"> · {t.freeAbove(fmt.money(free))}</span>
        ) : null}
      </span>
      <span className="text-caption text-muted-foreground">
        {t.note(fmt.money(EXAMPLE_COSTS.standard), fmt.money(EXAMPLE_COSTS.express))}
      </span>
    </section>
  )
}
