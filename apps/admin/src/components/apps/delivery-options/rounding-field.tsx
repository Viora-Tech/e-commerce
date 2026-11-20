'use client'

import { PRICE_ROUNDINGS, type PriceRounding } from '@commerce/core/delivery-options'
import ChoiceField from '@/components/apps/gst-invoices/choice-field'
import { deliveryPagesContent } from '@/data/delivery-options-pages'
import { useCopy } from '@/hooks/use-copy'

type RoundingFieldProps = {
  id: string
  value: PriceRounding
  onChange: (next: PriceRounding) => void
  /** The courier list's help also names what faster couriers add; a fixed option's does not. */
  help?: 'list' | 'fixed'
}

/** The select's value back to a rounding; anything unknown is the ₹10 rule. */
export const roundingOf = (v: string): PriceRounding =>
  PRICE_ROUNDINGS.find((r) => r === v) ?? 'ten'

/** "Round delivery prices" (`price.rounding`): …9, …49/…99, the next ₹10, or off. */
export default function RoundingField({ id, value, onChange, help = 'list' }: RoundingFieldProps) {
  // Hooks
  const pages = useCopy(deliveryPagesContent)

  // Render logic
  const c = pages.courierList

  return (
    <ChoiceField
      id={id}
      label={c.round}
      value={value}
      options={PRICE_ROUNDINGS.map((v) => ({ value: v, label: c.roundItems[v] }))}
      help={help === 'fixed' ? c.roundHelpFixed : c.roundHelp}
      onChange={(v) => onChange(roundingOf(v))}
    />
  )
}
