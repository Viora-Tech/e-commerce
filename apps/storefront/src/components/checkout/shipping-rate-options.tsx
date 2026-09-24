'use client'

import { formatPaise } from '@commerce/blocks'
import { checkoutContent as content } from '@/data/checkout'
import type { CheckoutRate } from '@/lib/shipping'

type ShippingRateOptionsProps = {
  options: CheckoutRate[]
  selectedId: string | null
  onSelect: (id: string) => void
}

/** Shipping method radios, shown when an address has more than one rate to pick from. */
export default function ShippingRateOptions({
  options,
  selectedId,
  onSelect,
}: ShippingRateOptionsProps) {
  return (
    <fieldset className="checkout__group">
      <legend className="h4">{content.shippingMethod}</legend>
      {options.map((o) => (
        <label key={o.id} className="checkout__option">
          <input
            type="radio"
            name="shipping-rate"
            value={o.id}
            checked={selectedId === o.id}
            onChange={() => onSelect(o.id)}
          />
          <span className="checkout__option-label">
            {o.name}
            {o.dateRange ? (
              <span className="checkout__option-meta text-small">
                {content.rateDelivery(o.dateRange)}
              </span>
            ) : null}
          </span>
          <span>{o.pricePaise === 0 ? content.shippingFree : formatPaise(o.pricePaise)}</span>
        </label>
      ))}
    </fieldset>
  )
}
