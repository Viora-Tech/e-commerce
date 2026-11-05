import { useState } from 'react'
import type { CheckoutSection } from './checkout-sections'

/**
 * The step the checkout opens on. A fresh delivery quote reads as pending for a moment, which
 * would send a shopper with saved details from Payment back to Delivery: while a quote runs the
 * last step holds, and it moves again once the answer is in.
 */
export function useHeldStep(open: CheckoutSection, quoting: boolean): CheckoutSection {
  const [held, setHeld] = useState(open)
  if (!quoting && held !== open) setHeld(open)
  return quoting ? held : open
}
