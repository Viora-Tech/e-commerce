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

// The arithmetic and formatting live in a zod-free module the storefront's checkout form
// imports in the browser; re-exported so server code keeps one import.
export {
  applyPaymentAdjustment,
  formatPaymentAdjustment,
  paymentAdjustmentPaise,
} from './adjustment-math'
