import { z } from 'zod'

/**
 * A surcharge or discount tied to a payment method. `value` is paise for
 * `fixed` and basis points (1/100 of a percent) for `percent`; negative
 * values are discounts. Percent applies to the order subtotal.
 */
export const PaymentAdjustmentSchema = z.object({
  type: z.enum(['fixed', 'percent']),
  value: z.number().int().min(-10_000_000).max(10_000_000),
  label: z.string().max(60).optional(),
})
export type PaymentAdjustment = z.infer<typeof PaymentAdjustmentSchema>

/** Round half away from zero so a −2% discount on ₹99.99 is −₹2.00, not −₹1.99. */
const roundHalfUp = (n: number): number => Math.sign(n) * Math.round(Math.abs(n))

export function paymentAdjustmentPaise(
  subtotalPaise: number,
  adj: PaymentAdjustment | null | undefined,
): number {
  if (!adj || adj.value === 0) return 0
  if (adj.type === 'fixed') return adj.value
  return roundHalfUp((subtotalPaise * adj.value) / 10_000)
}

export function applyPaymentAdjustment(
  subtotalPaise: number,
  adj: PaymentAdjustment | null | undefined,
): { adjustmentPaise: number; totalPaise: number } {
  const adjustmentPaise = paymentAdjustmentPaise(subtotalPaise, adj)
  // A discount can never push the order below zero.
  return { adjustmentPaise, totalPaise: Math.max(0, subtotalPaise + adjustmentPaise) }
}

/** "+₹49", "−2%", "+1.5%" — for option rows in checkout and admin. */
export function formatPaymentAdjustment(adj: PaymentAdjustment): string {
  const sign = adj.value < 0 ? '−' : '+'
  const abs = Math.abs(adj.value)
  if (adj.type === 'percent') {
    const pct = abs / 100
    return `${sign}${Number.isInteger(pct) ? pct : pct.toFixed(2).replace(/0+$/, '')}%`
  }
  const rupees = abs / 100
  return `${sign}₹${Number.isInteger(rupees) ? rupees : rupees.toFixed(2)}`
}
