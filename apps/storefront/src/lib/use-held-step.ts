import { useState } from 'react'
import { type CheckoutSection, firstOpenSection, type SectionGates } from './checkout-sections'

/**
 * The step on screen: the one the shopper picked, else the first still open. A fresh delivery
 * quote reads as pending for a moment, which would send a shopper with saved details from
 * Payment back to Delivery: while a quote runs the last step holds.
 */
export function useHeldStep(
  picked: CheckoutSection | null,
  gates: SectionGates,
  sections: readonly CheckoutSection[],
): CheckoutSection {
  const open = firstOpenSection(gates, sections) ?? 'payment'
  const quoting = gates.shipping === 'pending'
  const [held, setHeld] = useState(open)
  if (!quoting && held !== open) setHeld(open)
  return picked ?? (quoting ? held : open)
}
