'use client'

import { useFormatPaise } from '@commerce/blocks'
import CheckoutIcon from '@/components/checkout/checkout-icon'
import CheckoutParcels from '@/components/checkout/checkout-parcels'
import DeliveryRouteChoices from '@/components/checkout/delivery-route-choices'
import OptionCard from '@/components/checkout/option-card'
import { checkoutContent as content } from '@/data/checkout'
import { deliveryOptionsContent as appCopy } from '@/data/delivery-options'
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
  /** Delivery options app: the sub-choice under the picked card. */
  routeKey?: string | null
  onRoute?: (routeKey: string | null) => void
  /** Delivery options app: the "Insure this shipment" checkbox, when offered. */
  insurance?: { offered: boolean; on: boolean; pricePaise: number | null } | null
  onInsurance?: (insured: boolean) => void
  /** The address is outside India: it asks for the address, not a PIN code (#64). */
  abroad?: boolean
}

/**
 * The Shipping card's options (design: radio cards with the option's name, the date it
 * arrives under it and the price on the right): the store's options for this address, each
 * with the date it arrives ("Arrives tomorrow, Sat 11 Oct", from the courier for this PIN
 * code or the option's own days, `lib/rate-dates.ts`); the first to arrive is marked Fastest.
 * The cheapest is picked until the shopper picks another, and Pay and Express both charge the
 * picked one. Free shipping is one card. An order leaving from more than one warehouse lists
 * its parcels under the cards. With the Delivery options app each card names its courier
 * ("Express · Blue Dart"), a product rule may offer couriers to pick between under it, a
 * prepaid-only option says so, and the insurance checkbox sits under the cards.
 */
export default function DeliveryMethod({
  shipping,
  rates,
  selectedId,
  checking,
  unserviceable,
  estimate,
  onSelect,
  routeKey = null,
  onRoute,
  insurance = null,
  onInsurance,
  abroad = false,
}: DeliveryMethodProps) {
  // Hooks
  const money = useFormatPaise()

  // Helpers
  const price = (paise: number): string => (paise === 0 ? content.shippingFree : money(paise))
  const meta = (o: CheckoutRate) =>
    o.pricePaise === 0 && o.delivery && o.delivery.listPricePaise > 0 ? (
      <span className="flex items-baseline gap-1.5">
        <s className="text-[0.75rem] text-ck-muted">{money(o.delivery.listPricePaise)}</s>
        {content.shippingFree}
      </span>
    ) : (
      price(o.pricePaise)
    )

  // Early returns
  if (checking || !shipping) {
    return (
      <div className="flex min-h-16 items-center gap-3 rounded-ck border border-dashed border-ck-line-strong bg-ck-bg px-4 text-[0.875rem] text-ck-muted">
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
            {abroad ? content.delivery.pendingAbroad : content.delivery.pending}
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
      <fieldset className="flex flex-col gap-3 border-0! p-0!">
        <legend className="sr-only">{content.deliveryMethod}</legend>
        {free ? (
          <OptionCard
            name="shipping-rate"
            value="free"
            checked
            onChange={() => undefined}
            title={content.delivery.free}
            icon="truck"
            description={shipping.arrives}
            meta={content.shippingFree}
          />
        ) : (
          rates.map((o) => {
            const picked = selectedId === o.id
            const choices = o.delivery?.choices ?? []
            const sub = picked ? choices.find((c) => c.routeKey === routeKey) : undefined
            return (
              <div key={o.id} className="flex flex-col gap-1.5">
                <OptionCard
                  name="shipping-rate"
                  value={o.id}
                  checked={picked}
                  icon={o.fastest ? 'bolt' : 'truck'}
                  onChange={() => onSelect(o.id)}
                  title={
                    <span className="flex flex-wrap items-center gap-2">
                      {sub
                        ? `${o.delivery?.optionName} · ${sub.label}`
                        : o.name || content.delivery.standard}
                      {o.fastest ? (
                        <span className="rounded-[0.3125rem] bg-ck-soft px-1.5 text-[0.75rem] leading-[1.25rem] font-medium text-ck-muted">
                          {content.delivery.fastest}
                        </span>
                      ) : null}
                    </span>
                  }
                  description={
                    sub?.arrives ??
                    o.arrives ??
                    (o.dateRange ? content.rateDelivery(o.dateRange) : null) ??
                    o.instructions ??
                    null
                  }
                  meta={sub ? price(sub.pricePaise) : meta(o)}
                  note={o.delivery && !o.delivery.codAllowed ? appCopy.prepaidOnly : null}
                />
                {picked && choices.length > 1 && onRoute ? (
                  <DeliveryRouteChoices
                    optionId={o.id}
                    choices={choices}
                    selected={routeKey}
                    onSelect={onRoute}
                  />
                ) : null}
              </div>
            )
          })
        )}
      </fieldset>
      {insurance?.offered && onInsurance ? (
        <label className="flex w-fit cursor-pointer items-center gap-2 pt-1 text-[0.8125rem] text-ck-ink/85">
          <input
            type="checkbox"
            checked={insurance.on}
            onChange={(e) => onInsurance(e.target.checked)}
            className="size-4 cursor-pointer rounded accent-[var(--ck-accent)]"
          />
          {appCopy.insure(insurance.pricePaise ? money(insurance.pricePaise) : null)}
        </label>
      ) : null}
      <CheckoutParcels parcels={shipping.parcels} />
    </div>
  )
}
