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
  /** Why the address cannot be delivered to, when it cannot. */
  estimate: string | null
  onSelect: (id: string) => void
}

const price = (paise: number): string => (paise === 0 ? content.shippingFree : formatPaise(paise))

/**
 * The Shipping card's options (design: radio cards with the option's name, the date it
 * arrives under it and the price on the right): the store's options for this address, each
 * with the date it arrives ("Arrives tomorrow, Sat 11 Oct", from the courier for this PIN
 * code or the option's own days, `lib/rate-dates.ts`); the first to arrive is marked Fastest.
 * The cheapest is picked until the shopper picks another, and Pay and Express both charge the
 * picked one. Free shipping is one card. An order leaving from more than one warehouse lists
 * its parcels under the cards.
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
      <div className="flex min-h-16 items-center gap-3 rounded-ck border border-dashed border-ck-line bg-ck-field px-4 text-[0.875rem] text-ck-muted">
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
    <div className="flex flex-col gap-2">
      <fieldset className="flex flex-col gap-2 border-0! p-0!">
        <legend className="sr-only">{content.deliveryMethod}</legend>
        {free ? (
          <OptionCard
            name="shipping-rate"
            value="free"
            checked
            onChange={() => undefined}
            title={content.delivery.free}
            description={shipping.arrives}
            meta={content.shippingFree}
          />
        ) : (
          rates.map((o) => {
            const picked = selectedId === o.id
            return (
              <OptionCard
                key={o.id}
                name="shipping-rate"
                value={o.id}
                checked={picked}
                onChange={() => onSelect(o.id)}
                title={
                  <span className="flex flex-wrap items-center gap-2">
                    {o.name || content.delivery.standard}
                    {o.fastest ? (
                      <span className="rounded-[0.3125rem] bg-ck-soft px-1.5 text-[0.75rem] leading-[1.25rem] font-medium text-ck-muted">
                        {content.delivery.fastest}
                      </span>
                    ) : null}
                  </span>
                }
                description={o.arrives ?? (o.dateRange ? content.rateDelivery(o.dateRange) : null)}
                meta={price(o.pricePaise)}
              />
            )
          })
        )}
      </fieldset>
      <CheckoutParcels parcels={shipping.parcels} />
    </div>
  )
}
