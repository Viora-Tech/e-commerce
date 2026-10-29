import type { CartView } from '@commerce/core'
import { useState, useTransition } from 'react'
import { isDigitalOnly } from '@/lib/checkout-preview'
import type { GateState } from '@/lib/checkout-sections'
import { cleanPincode } from '@/lib/checkout-validation'
import { retryOnce } from '@/lib/retry-once'
import type { CheckoutRate, CheckoutShipping } from '@/lib/shipping'
import { checkoutShippingAction } from '@/lib/shipping-actions'

export const isFullPincode = (v: string): boolean => /^[1-9]\d{5}$/.test(cleanPincode(v))

/** The Delivery options app's choice Pay sends: the quote, the sub-choice and the tick. */
export type DeliveryChoiceForm = { quoteId: string; routeKey: string | null; insured: boolean }

/** The picked card as Pay charges it: a sub-choice ("Blue Dart Air") brings its own price. */
function withChoice(
  rate: CheckoutRate | undefined,
  routeKey: string | null,
): CheckoutRate | undefined {
  const sub = rate?.delivery?.choices.find((c) => c.routeKey === routeKey)
  if (!rate || !sub) return rate
  return {
    ...rate,
    name: `${rate.delivery?.optionName ?? rate.name} · ${sub.label}`,
    pricePaise: sub.pricePaise,
    arrives: sub.arrives,
  }
}

/**
 * The courier's answer for the address on screen: serviceability, the rates and the pick,
 * and the Shipping step's gate. Asked as soon as six digits are in; `checkoutAction` asks
 * again on Pay whatever this said. With the Delivery options app, also the sub-choice under
 * a card and the insurance tick (unticking asks again: the routes are re-picked).
 */
export function useCheckoutShipping(cart: CartView, onNoCod: () => void) {
  const [checking, startCheck] = useTransition()
  const [shipping, setShipping] = useState<CheckoutShipping | null>(null)
  /** The courier has answered (or failed to) for the PIN code on screen. */
  const [quoted, setQuoted] = useState(false)
  const [rateId, setRateId] = useState<string | null>(null)
  const [routeKey, setRouteKey] = useState<string | null>(null)
  const [declineInsurance, setDeclineInsurance] = useState(false)
  const [asked, setAsked] = useState<{ pincode: string; stateCode: string } | null>(null)

  const ask = (pincode: string, stateCode: string, decline: boolean, keep: boolean) => {
    const quoteId = keep ? (shipping?.deliveryQuote?.quoteId ?? null) : null
    startCheck(async () => {
      const next = await retryOnce(() =>
        checkoutShippingAction({ pincode, stateCode }, { declineInsurance: decline, quoteId }),
      )
      setShipping(next)
      setQuoted(true)
      // Keep the shopper's pick when it is still offered, else the first (Standard).
      const options = next?.rates.kind === 'rates' ? next.rates.options : []
      setRateId((prev) => (options.some((o) => o.id === prev) ? prev : (options[0]?.id ?? null)))
      setRouteKey((prev) =>
        options.some((o) => o.delivery?.choices.some((c) => c.routeKey === prev)) ? prev : null,
      )
      const r = next?.delivery
      if (r?.ok && r.serviceable && !r.codAvailable) onNoCod()
    })
  }

  const checkPincode = (raw: string, stateCode: string) => {
    setShipping(null)
    setQuoted(false)
    const pincode = cleanPincode(raw)
    if (isDigitalOnly(cart) || !isFullPincode(pincode)) return
    setAsked({ pincode, stateCode })
    ask(pincode, stateCode, declineInsurance, false)
  }

  const toggleInsurance = (insured: boolean) => {
    setDeclineInsurance(!insured)
    if (asked) ask(asked.pincode, asked.stateCode, !insured, true)
  }

  const pickRate = (id: string | null) => {
    setRateId(id)
    setRouteKey(null)
  }

  const rates = shipping?.rates.kind === 'rates' ? shipping.rates.options : []
  const rate = withChoice(
    rates.find((r) => r.id === rateId),
    routeKey,
  )
  const delivery = shipping?.delivery
  const unserviceable =
    (delivery?.ok === true && !delivery.serviceable) || shipping?.rates.kind === 'none'
  const gate: GateState = isDigitalOnly(cart)
    ? 'ok'
    : unserviceable
      ? 'blocked'
      : checking || !quoted
        ? 'pending'
        : shipping?.rates.kind === 'free' || rate
          ? 'ok'
          : 'blocked'
  const quote = shipping?.deliveryQuote
  const deliveryChoice: DeliveryChoiceForm | null = quote
    ? {
        quoteId: quote.quoteId,
        routeKey,
        insured: quote.insurance.offered ? !declineInsurance : true,
      }
    : null

  return {
    checking,
    shipping,
    rates,
    rate,
    rateId,
    setRateId: pickRate,
    /** Delivery options app: the sub-choice and the insurance tick under the cards. */
    app: { routeKey, setRouteKey, insurance: quote?.insurance ?? null, toggleInsurance },
    /** What Pay sends about shipping: the picked rate, and the app's choice when it is on. */
    formFields: {
      ...(rateId ? { shippingRate: rateId } : {}),
      ...(deliveryChoice ? { deliveryQuote: deliveryChoice } : {}),
    },
    unserviceable,
    gate,
    checkPincode,
  }
}
