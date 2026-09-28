/** SOURCE OF TRUTH: payment method surcharge and discount arithmetic — WHAT: how an adjustment changes a subtotal and how it is labelled / WHY: checkout (in the browser), the server and admin must agree to the paisa, without shipping zod to the checkout page */
/**
 * Payment-method surcharges and discounts as numbers and labels. No zod: the checkout
 * form runs this in the browser (`@commerce/core/adjustment-math`); the schema that
 * validates a stored adjustment stays in `./adjustments`, which re-exports all of this.
 */

/** Structurally what `PaymentAdjustmentSchema` parses to. */
export type PaymentAdjustmentValue = {
  type: 'fixed' | 'percent'
  value: number
  label?: string | undefined
}

/** Round half away from zero so a −2% discount on ₹99.99 is −₹2.00, not −₹1.99. */
const roundHalfUp = (n: number): number => Math.sign(n) * Math.round(Math.abs(n))

export function paymentAdjustmentPaise(
  subtotalPaise: number,
  adj: PaymentAdjustmentValue | null | undefined,
): number {
  if (!adj || adj.value === 0) return 0
  if (adj.type === 'fixed') return adj.value
  return roundHalfUp((subtotalPaise * adj.value) / 10_000)
}

export function applyPaymentAdjustment(
  subtotalPaise: number,
  adj: PaymentAdjustmentValue | null | undefined,
): { adjustmentPaise: number; totalPaise: number } {
  const adjustmentPaise = paymentAdjustmentPaise(subtotalPaise, adj)
  // A discount can never push the order below zero.
  return { adjustmentPaise, totalPaise: Math.max(0, subtotalPaise + adjustmentPaise) }
}

/** "+₹49", "−2%", "+1.5%" — for option rows in checkout and admin. */
export function formatPaymentAdjustment(adj: PaymentAdjustmentValue): string {
  const sign = adj.value < 0 ? '−' : '+'
  const abs = Math.abs(adj.value)
  if (adj.type === 'percent') {
    const pct = abs / 100
    return `${sign}${Number.isInteger(pct) ? pct : pct.toFixed(2).replace(/0+$/, '')}%`
  }
  const rupees = abs / 100
  return `${sign}₹${Number.isInteger(rupees) ? rupees : rupees.toFixed(2)}`
}
