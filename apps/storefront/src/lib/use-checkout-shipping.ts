import type { CartView } from '@commerce/core'
import { cleanPostalCode, isAbroad, postalCodeProblem } from '@commerce/core/checkout-address'
import { useState, useTransition } from 'react'
import { isDigitalOnly } from '@/lib/checkout-preview'
import type { GateState } from '@/lib/checkout-sections'
import { cleanPincode } from '@/lib/checkout-validation'
import { nextRateId } from '@/lib/default-rate'
import { retryOnce } from '@/lib/retry-once'
import type { CheckoutRate, CheckoutShipping } from '@/lib/shipping'
import { checkoutShippingAction } from '@/lib/shipping-actions'

export const isFullPincode = (v: string): boolean => /^[1-9]\d{5}$/.test(cleanPincode(v))

/** Enough of the address to quote: six PIN digits in India, a postcode that will do abroad. */
export const isQuotable = (raw: string, countryCode: string): boolean =>
  isAbroad(countryCode) ? postalCodeProblem(countryCode, raw) === null : isFullPincode(raw)

type Asked = { pincode: string; stateCode: string; countryCode: string }

/** The Delivery options app's choice Pay sends: the quote, the sub-choice and the tick. */
export type DeliveryChoiceForm = {
  quoteId: string
  routeKey: string | null
  insured: boolean
  /** A cart split by product rules: the courier picked per parcel (null: its own pick). */
  parcelRouteKeys?: Array<string | null> | undefined
}

/** Each parcel's picked courier card: the one picked, else its first (its own pick). */
export function pickedParcelCards(
  rate: CheckoutRate | undefined,
  keys: readonly (string | null)[],
) {
  return (rate?.delivery?.parcels ?? []).map(
    (p, i) => p.choices.find((c) => c.routeKey === keys[i]) ?? p.choices[0],
  )
}

/** A card picked per parcel as Pay charges it: every parcel's courier added up. */
function withParcelChoices(rate: CheckoutRate, keys: readonly (string | null)[]): CheckoutRate {
  const parcels = rate.delivery?.parcels ?? []
  const cards = pickedParcelCards(rate, keys)
  const sum = (f: (i: number) => number) => parcels.reduce((s, _, i) => s + f(i), 0)
  const fees = cards.filter((c) => c?.codFeePaise != null)
  return {
    ...rate,
    pricePaise: sum((i) => cards[i]?.pricePaise ?? 0),
    ...(rate.delivery
      ? {
          delivery: {
            ...rate.delivery,
            codPricePaise: sum(
              (i) =>
                cards[i]?.codPricePaise ?? parcels[i]?.codPricePaise ?? cards[i]?.pricePaise ?? 0,
            ),
            codCarrier: null,
          },
        }
      : {}),
    ...(fees.length
      ? { codSurchargePaise: fees.reduce((s, c) => s + (c?.codFeePaise ?? 0), 0) }
      : {}),
  }
}

/** The picked card as Pay charges it: a sub-choice ("Blue Dart Air") brings its own price. */
function withChoice(
  rate: CheckoutRate | undefined,
  routeKey: string | null,
  parcelKeys: readonly (string | null)[] = [],
): CheckoutRate | undefined {
  if (rate?.delivery?.parcels?.length) return withParcelChoices(rate, parcelKeys)
  const sub = rate?.delivery?.choices.find((c) => c.routeKey === routeKey)
  if (!rate || !sub) return rate
  return {
    ...rate,
    // The courier list has no option of its own to name: just "Blue Dart Air", not "Standard · …".
    name:
      rate.delivery?.layout === 'list'
        ? sub.label
        : `${rate.delivery?.optionName ?? rate.name} · ${sub.label}`,
    pricePaise: sub.pricePaise,
    arrives: sub.arrives,
    // A courier list card pays on delivery with its own courier at its own COD price.
    ...(rate.delivery?.layout === 'list' && sub.codPricePaise != null
      ? { delivery: { ...rate.delivery, codPricePaise: sub.codPricePaise, codCarrier: null } }
      : {}),
    // A list card's own COD charge, when the option shows it as its own line.
    ...(rate.delivery?.layout === 'list' ? { codSurchargePaise: sub.codFeePaise ?? null } : {}),
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
  /** The ticked card is the shopper's own choice, not checkout's default. */
  const [shopperPicked, setShopperPicked] = useState(false)
  const [routeKey, setRouteKey] = useState<string | null>(null)
  /** A cart split by product rules: the courier picked for each parcel, by parcel index. */
  const [parcelKeys, setParcelKeys] = useState<Array<string | null>>([])
  /** The shopper's insurance tick; null until they touch it (each option's own default). */
  const [insure, setInsure] = useState<boolean | null>(null)
  /** "Want a different courier?" under the courier list (owner, 20 Nov 2026); blank: none. */
  const [courierRequest, setCourierRequest] = useState('')
  const [asked, setAsked] = useState<Asked | null>(null)

  const ask = (to: Asked, tick: boolean | null, keep: boolean) => {
    const quoteId = keep ? (shipping?.deliveryQuote?.quoteId ?? null) : null
    startCheck(async () => {
      const next = await retryOnce(() => checkoutShippingAction(to, { insure: tick, quoteId }))
      setShipping(next)
      setQuoted(true)
      // Keep the shopper's own pick while it is offered, else the cheapest (#1519).
      const options = next?.rates.kind === 'rates' ? next.rates.options : []
      setRateId((prev) => nextRateId(options, prev, shopperPicked))
      setRouteKey((prev) =>
        options.some((o) => o.delivery?.choices.some((c) => c.routeKey === prev)) ? prev : null,
      )
      // Each parcel keeps its courier while that parcel still offers it.
      setParcelKeys((prev) =>
        prev.map((key, i) =>
          options.some((o) => o.delivery?.parcels?.[i]?.choices.some((c) => c.routeKey === key))
            ? key
            : null,
        ),
      )
      const r = next?.delivery
      if (r?.ok && r.serviceable && !r.codAvailable) onNoCod()
    })
  }

  /** Quote the address on screen: a PIN code in India, the country (and postcode) abroad. */
  const checkPincode = (raw: string, stateCode: string, countryCode = 'IN') => {
    setShipping(null)
    setQuoted(false)
    const abroad = isAbroad(countryCode)
    const pincode = abroad ? cleanPostalCode(raw) : cleanPincode(raw)
    if (isDigitalOnly(cart) || !isQuotable(pincode, countryCode)) return
    const to = { pincode, stateCode, countryCode }
    setAsked(to)
    ask(to, insure, false)
  }

  const toggleInsurance = (insured: boolean) => {
    setInsure(insured)
    if (asked) ask(asked, insured, true)
  }

  const pickRate = (id: string | null) => {
    setRateId(id)
    setShopperPicked(id !== null)
    setRouteKey(null)
    setParcelKeys([])
  }

  /** A courier picked for one parcel of a cart split by product rules. */
  const pickParcelRoute = (index: number, key: string) => {
    setParcelKeys((prev) => {
      const next = [...prev]
      while (next.length <= index) next.push(null)
      next[index] = key
      return next
    })
    setShopperPicked(true)
  }

  /** A courier picked under a card makes that card the shopper's own choice too. */
  const pickRoute = (key: string | null) => {
    setRouteKey(key)
    if (key !== null) setShopperPicked(true)
  }

  const rates = shipping?.rates.kind === 'rates' ? shipping.rates.options : []
  const rate = withChoice(
    rates.find((r) => r.id === rateId),
    routeKey,
    parcelKeys,
  )
  const parcelCount = rate?.delivery?.parcels?.length ?? 0
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
        // What the picked card's price assumes, so Pay charges what the card showed.
        insured: rate?.delivery?.insurance?.on ?? quote.insurance.on,
        ...(parcelCount
          ? {
              parcelRouteKeys: Array.from({ length: parcelCount }, (_, i) => parcelKeys[i] ?? null),
            }
          : {}),
      }
    : null
  /* The tick under the cards follows the picked card: its own offer and what it adds there
     ("Insure this parcel (+₹20)"); before a card is picked, the first that offers it. */
  const own = rate?.delivery?.insurance
  const insurance = own
    ? { offered: own.offered, on: own.on, pricePaise: own.extraPaise }
    : (quote?.insurance ?? null)

  return {
    checking,
    shipping,
    rates,
    rate,
    rateId,
    setRateId: pickRate,
    /** Delivery options app: the sub-choice and the insurance tick under the cards. */
    app: {
      routeKey,
      setRouteKey: pickRoute,
      parcelKeys,
      setParcelRoute: pickParcelRoute,
      insurance,
      toggleInsurance,
      courierRequest,
      setCourierRequest,
    },
    /** What Pay sends about shipping: the picked rate, and the app's choice when it is on. */
    formFields: {
      ...(rateId ? { shippingRate: rateId } : {}),
      ...(deliveryChoice ? { deliveryQuote: deliveryChoice } : {}),
      ...(deliveryChoice && courierRequest.trim() ? { courierRequest: courierRequest.trim() } : {}),
    },
    unserviceable,
    gate,
    checkPincode,
  }
}
