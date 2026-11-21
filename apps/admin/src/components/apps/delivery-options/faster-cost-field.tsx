'use client'

import { COURIER_EXTRAS, type CourierExtra } from '@commerce/core/delivery-options'
import ChoiceField from '@/components/apps/gst-invoices/choice-field'
import { deliveryOptionSectionsContent } from '@/data/delivery-option-sections'
import { useCopy } from '@/hooks/use-copy'

type FasterCostFieldProps = {
  id: string
  value: CourierExtra
  onChange: (next: CourierExtra) => void
}

/** The select's value back to a mode; anything unknown is the difference. */
const extraOf = (v: string): CourierExtra => COURIER_EXTRAS.find((x) => x === v) ?? 'difference'

/** The order the choices read in: the default first. */
const ORDER: readonly CourierExtra[] = ['difference', 'full', 'none']

/**
 * "Faster couriers cost" for a courier list (`couriers.extra`): the first courier's price plus
 * the difference, the faster courier's own full price (owner, 21 Nov 2026), or nothing extra.
 * The help line says what the chosen one shows at checkout.
 */
export default function FasterCostField({ id, value, onChange }: FasterCostFieldProps) {
  // Hooks
  const copy = useCopy(deliveryOptionSectionsContent)

  // Render logic
  const t = copy.faster

  return (
    <ChoiceField
      id={id}
      label={t.label}
      value={value}
      options={ORDER.map((v) => ({ value: v, label: t.items[v] }))}
      help={t.help[value]}
      onChange={(v) => onChange(extraOf(v))}
    />
  )
}
