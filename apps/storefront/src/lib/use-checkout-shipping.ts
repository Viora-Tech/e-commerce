import type { CartView } from '@commerce/core'
import { useState, useTransition } from 'react'
import { isDigitalOnly } from '@/lib/checkout-preview'
import type { GateState } from '@/lib/checkout-sections'
import { cleanPincode } from '@/lib/checkout-validation'
import { retryOnce } from '@/lib/retry-once'
import type { CheckoutShipping } from '@/lib/shipping'
import { checkoutShippingAction } from '@/lib/shipping-actions'

export const isFullPincode = (v: string): boolean => /^[1-9]\d{5}$/.test(cleanPincode(v))

/**
 * The courier's answer for the address on screen: serviceability, the rates and the pick,
 * and the Shipping step's gate. Asked as soon as six digits are in; `checkoutAction` asks
 * again on Pay whatever this said.
 */
export function useCheckoutShipping(cart: CartView, onNoCod: () => void) {
  const [checking, startCheck] = useTransition()
  const [shipping, setShipping] = useState<CheckoutShipping | null>(null)
  /** The courier has answered (or failed to) for the PIN code on screen. */
  const [quoted, setQuoted] = useState(false)
  const [rateId, setRateId] = useState<string | null>(null)

  const checkPincode = (raw: string, stateCode: string) => {
    setShipping(null)
    setQuoted(false)
    const pincode = cleanPincode(raw)
    if (isDigitalOnly(cart) || !isFullPincode(pincode)) return
    startCheck(async () => {
      const next = await retryOnce(() => checkoutShippingAction({ pincode, stateCode }))
      setShipping(next)
      setQuoted(true)
      // Keep the shopper's pick when it is still offered, else the cheapest.
      const options = next?.rates.kind === 'rates' ? next.rates.options : []
      setRateId((prev) => (options.some((o) => o.id === prev) ? prev : (options[0]?.id ?? null)))
      const r = next?.delivery
      if (r?.ok && r.serviceable && !r.codAvailable) onNoCod()
    })
  }

  const rates = shipping?.rates.kind === 'rates' ? shipping.rates.options : []
  const rate = rates.find((r) => r.id === rateId)
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

  return { checking, shipping, rates, rate, rateId, setRateId, unserviceable, gate, checkPincode }
}
