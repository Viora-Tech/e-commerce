'use client'

import { formatPaise } from '@commerce/blocks'
import CheckoutIcon from '@/components/checkout/checkout-icon'
import CheckoutParcels from '@/components/checkout/checkout-parcels'
import OptionCard from '@/components/checkout/option-card'
import { checkoutContent as content } from '@/data/checkout'
import type { CheckoutRate, CheckoutShipping } from '@/lib/shipping'

type DeliveryMethodProps = {
  shipping: CheckoutShipping | null
  rates: CheckoutRate[]
  selectedId: string | null
  checking: boolean
  unserviceable: boolean
  /** The courier's line for the address, shown on the single option. */
  estimate: string | null
  onSelect: (id: string) => void
}

const price = (paise: number): string => (paise === 0 ? content.shippingFree : formatPaise(paise))

/**
 * How the order travels. Before the PIN code is checked it says so; one rate is shown as
 * the chosen card; several are cards to pick from, each with its own dates and price. An order
 * leaving from more than one warehouse lists its parcels under the cards.
 */
export default function DeliveryMethod({
  shipping,
  rates,
  selectedId,
  checking,
  unserviceable,
  estimate,
  onSelect,
}: DeliveryMethodProps) {
  // Early returns
  if (checking || !shipping) {
    return (
      <div className="flex min-h-16 items-center gap-3 rounded-ck border border-dashed border-ck-line bg-ck-soft px-4 text-[0.875rem] text-ck-muted">
        {checking ? (
          <>
            <CheckoutIcon
              name="spinner"
              className="size-4 animate-spin motion-reduce:animate-none"
            />
            {content.delivery.checking}
          </>
        ) : (
          <>
            <CheckoutIcon name="truck" className="size-4" />
            {content.delivery.pending}
          </>
        )}
      </div>
    )
  }
  if (unserviceable) {
    return (
      <div
        role="alert"
        className="flex min-h-16 items-center gap-3 rounded-ck border border-ck-danger/40 bg-ck-danger-soft px-4 text-[0.875rem] text-ck-danger"
      >
        <CheckoutIcon name="alert" className="size-4" />
        {estimate}
      </div>
    )
  }

  // Render logic
  const free = shipping.rates.kind === 'free'

  return (
    <div className="flex flex-col gap-3">
      <fieldset className="flex flex-col gap-2.5 border-0! p-0!">
        <legend className="sr-only">{content.deliveryMethod}</legend>
        {free ? (
          <OptionCard
            name="shipping-rate"
            value="free"
            checked
            onChange={() => undefined}
            icon="truck"
            title={content.delivery.free}
            description={estimate}
            meta={content.shippingFree}
          />
        ) : (
          rates.map((o) => (
            <OptionCard
              key={o.id}
              name="shipping-rate"
              value={o.id}
              checked={selectedId === o.id}
              onChange={() => onSelect(o.id)}
              icon="truck"
              title={o.name || content.delivery.standard}
              description={
                o.dateRange
                  ? content.rateDelivery(o.dateRange)
                  : rates.length === 1
                    ? estimate
                    : null
              }
              meta={price(o.pricePaise)}
            />
          ))
        )}
      </fieldset>
      <CheckoutParcels parcels={shipping.parcels} />
    </div>
  )
}
