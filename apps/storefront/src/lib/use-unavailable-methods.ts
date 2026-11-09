import type { CartView } from '@commerce/core'
import { useState } from 'react'
import { offeredMethods, unavailableOf, withoutUnavailable } from './checkout-preview'
import type { CheckoutResult } from './checkout-result'
import type { CheckoutMethod } from './payments'

/**
 * The checkout's ways to pay without the gateways the server said it cannot offer now (they
 * refused the store's API keys). `drop` takes a checkout result: it removes the refused gateways
 * and returns the next way to pay on offer, or null when the result named none. The next Pay
 * goes on the same order (`order/checkout-reopen.ts`).
 */
export function useUnavailableMethods(all: CheckoutMethod[], cart: CartView) {
  const [gone, setGone] = useState<readonly string[]>([])
  const drop = (r: CheckoutResult): string | null => {
    const refused = unavailableOf(r)
    if (!refused) return null
    setGone(refused)
    return offeredMethods(cart, withoutUnavailable(all, refused))[0]?.id ?? null
  }
  return { methods: withoutUnavailable(all, gone), drop }
}
