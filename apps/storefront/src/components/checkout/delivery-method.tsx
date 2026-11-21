'use client'

import { useFormatPaise } from '@commerce/blocks'
import { COURIER_REQUEST_MAX } from '@commerce/core/courier-request'
import { useEffect, useState } from 'react'
import CheckoutField from '@/components/checkout/checkout-field'
import CheckoutIcon from '@/components/checkout/checkout-icon'
import CheckoutParcels from '@/components/checkout/checkout-parcels'
import CourierList from '@/components/checkout/courier-list'
import DeliveryRouteChoices from '@/components/checkout/delivery-route-choices'
import InsuranceToggle from '@/components/checkout/insurance-toggle'
import OptionCard from '@/components/checkout/option-card'
import { checkoutContent as content } from '@/data/checkout'
import { deliveryOptionsContent as appCopy } from '@/data/delivery-options'
import { countdownIndex, deliveryCardLine, minutesUntil } from '@/lib/delivery-card-line'
import type { ShopperParcel } from '@/lib/parcels'
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
  /** Delivery options app: "Want a different courier?" under the courier list. */
  courierRequest?: string
  onCourierRequest?: (text: string) => void
  /** The address is outside India: it asks for the address, not a PIN code (#64). */
  abroad?: boolean
  /** Cash on delivery is a way to pay here: only then does a prepaid-only card say so. */
  codOffered?: boolean
}

/**
 * The parcels under the cards with the picked card's own dates for each (the engine run that
 * priced the card), so "Parcel 1 arrives" never disagrees with the card (#1781 item 11).
 */
function parcelsForCard(
  shipping: CheckoutShipping,
  selectedId: string | null,
  routeKey: string | null,
): ShopperParcel[] {
  const byCard = shipping.parcelDates
  if (!byCard || !selectedId) return shipping.parcels
  const dates = byCard[`${selectedId}|${routeKey ?? ''}`] ?? byCard[`${selectedId}|`]
  if (!dates) return shipping.parcels
  return shipping.parcels.map((p) => {
    const own = dates.find((d) => d.key === p.key)
    return own ? { ...p, dateRange: own.dateRange } : p
  })
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
 * prepaid-only option quietly says so when COD is offered, and the insurance checkbox sits under the cards.
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
  courierRequest = '',
  onCourierRequest,
  abroad = false,
  codOffered = false,
}: DeliveryMethodProps) {
  // Hooks
  const money = useFormatPaise()
  const [nowMs, setNowMs] = useState(() => Date.now())
  useEffect(() => {
    if (!shipping?.dispatchCutoffAt) return
    const tick = () => setNowMs(Date.now())
    // Catch up at once (the quote can land long after mount), then every 30 s: the countdown
    // moves by the minute and is never more than half a minute behind.
    const first = window.setTimeout(tick, 0)
    const id = window.setInterval(tick, 30_000)
    return () => {
      window.clearTimeout(first)
      window.clearInterval(id)
    }
  }, [shipping?.dispatchCutoffAt])

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
  /** The card's third line (Figma 942:513). Only the first-arriving card counts down. */
  const line = (
    rateId: string,
    title: string,
    facts: { mode: 'air' | 'express' | 'surface' | null; codAllowed: boolean | null },
    counts: boolean,
  ) => {
    const fastestAt = rates.findIndex((r) => r.fastest)
    const countdownRate = rates[fastestAt >= 0 ? fastestAt : 0]?.id ?? null
    return deliveryCardLine({
      title,
      ...facts,
      codOffered,
      minutesLeft:
        counts && rateId === countdownRate ? minutesUntil(shipping?.dispatchCutoffAt, nowMs) : null,
    })
  }

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
  const minutesLeft = minutesUntil(shipping.dispatchCutoffAt, nowMs)

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
            title={shipping.nothingShips ? content.delivery.notNeeded : content.delivery.free}
            icon="truck"
            description={shipping.nothingShips ? content.delivery.notNeededBody : shipping.arrives}
            meta={content.shippingFree}
            note={
              shipping.nothingShips
                ? null
                : deliveryCardLine({
                    title: '',
                    mode: null,
                    codAllowed: null,
                    codOffered,
                    minutesLeft,
                  })
            }
          />
        ) : (
          rates.map((o) => {
            const choices = o.delivery?.choices ?? []
            if (o.delivery?.layout === 'list' && choices.length > 0) {
              // The courier list (owner, 20 Nov 2026): compact rows, the first included at the
              // option's price, the rest show what they add; cash on delivery said once.
              const current = selectedId === o.id ? (routeKey ?? choices[0]?.routeKey) : null
              const counter = countdownIndex(choices.map((c) => c.earliest ?? null))
              const cod = o.delivery?.codAllowed ?? null
              return (
                <CourierList
                  key={o.id}
                  optionId={o.id}
                  choices={choices}
                  selected={current ?? null}
                  onPick={(key) => {
                    onSelect(o.id)
                    onRoute?.(key)
                  }}
                  price={price}
                  money={money}
                  preferred={o.delivery?.preferred === true}
                  fullPrices={o.delivery?.fullPrices === true}
                  heading={
                    !codOffered || cod === null
                      ? null
                      : cod
                        ? appCopy.codAvailableAll
                        : appCopy.prepaidOnly
                  }
                  note={(i) =>
                    deliveryCardLine({
                      title: choices[i]?.label ?? '',
                      mode: choices[i]?.mode ?? null,
                      codAllowed: null,
                      codOffered: false,
                      minutesLeft:
                        i === counter ? minutesUntil(shipping.dispatchCutoffAt, nowMs) : null,
                    })
                  }
                />
              )
            }
            const picked = selectedId === o.id
            const sub = picked ? choices.find((c) => c.routeKey === routeKey) : undefined
            return (
              <div key={o.id} className="flex flex-col gap-1.5">
                <OptionCard
                  name="shipping-rate"
                  value={o.id}
                  checked={picked}
                  icon={o.fastest ? 'plane' : 'truck'}
                  logo={sub ? null : (o.delivery?.logo ?? null)}
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
                  note={line(
                    o.id,
                    sub ? `${o.delivery?.optionName} · ${sub.label}` : o.name,
                    {
                      mode: (sub ? sub.mode : o.delivery?.mode) ?? null,
                      codAllowed: o.delivery?.codAllowed ?? null,
                    },
                    true,
                  )}
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
      {onCourierRequest && rates.some((r) => r.delivery?.layout === 'list') ? (
        <CheckoutField
          id="courier-request"
          label={appCopy.requestLabel}
          value={courierRequest}
          onChange={(e) => onCourierRequest(e.target.value)}
          placeholder={appCopy.requestPlaceholder}
          hint={appCopy.requestHelp}
          maxLength={COURIER_REQUEST_MAX}
          autoComplete="off"
        />
      ) : null}
      {insurance?.offered && onInsurance ? (
        <InsuranceToggle
          on={insurance.on}
          price={insurance.pricePaise ? money(insurance.pricePaise) : null}
          onChange={onInsurance}
        />
      ) : null}
      <CheckoutParcels parcels={parcelsForCard(shipping, selectedId, routeKey)} />
    </div>
  )
}
