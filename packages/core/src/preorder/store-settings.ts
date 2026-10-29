import { z } from 'zod'
import { PREORDER_NOTE_MAX } from './note'

/*
 * Store-wide rules for collecting a deposit pre-order's balance. Stored on
 * `store.preorder`. Client-safe: the admin form and the storefront notice
 * both read it.
 */

export const UNPAID_BALANCE_ACTIONS = ['none', 'cancel_refund', 'cancel_keep'] as const
export type UnpaidBalanceAction = (typeof UNPAID_BALANCE_ACTIONS)[number]

export const PreorderStoreSettingsSchema = z.object({
  /**
   * Ask for the balance automatically this many days before the earliest
   * expected ship date on the order. Null: only when the merchant asks.
   */
  autoRequestDaysBeforeShip: z.number().int().min(0).max(90).nullable().default(null),
  /** Days after the request to remind the shopper, at most two. Empty: no reminders. */
  reminderDays: z
    .array(z.number().int().min(1).max(90))
    .max(2)
    .default([3, 6])
    .transform((days) => [...new Set(days)].sort((a, b) => a - b)),
  /**
   * What happens when the balance is still unpaid `payWithinDays` after the
   * request: nothing, cancel and refund the deposit, or cancel and keep it
   * (the deposit is then non-refundable, and shoppers are told so up front).
   */
  unpaidAction: z.enum(UNPAID_BALANCE_ACTIONS).default('none'),
  payWithinDays: z.number().int().min(1).max(90).default(10),
  /**
   * The note under the pre-order button, in the cart and at checkout, and on the order email
   * (#936), for every pre-order product without its own (`product.preorder_note`). May use
   * `{ship_date}` / `{ship_month}` (see `./note.ts`). Null: no note.
   */
  note: z.string().trim().max(PREORDER_NOTE_MAX).nullable().default(null),
})
export type PreorderStoreSettings = z.infer<typeof PreorderStoreSettingsSchema>

export const defaultPreorderStoreSettings: PreorderStoreSettings = {
  autoRequestDaysBeforeShip: null,
  reminderDays: [3, 6],
  unpaidAction: 'none',
  payWithinDays: 10,
  note: null,
}

export function parsePreorderStoreSettings(raw: unknown): PreorderStoreSettings {
  const r = PreorderStoreSettingsSchema.safeParse(raw ?? {})
  return r.success ? r.data : defaultPreorderStoreSettings
}

/** True when an unpaid balance forfeits the deposit: shoppers must be told before they pay it. */
export const depositIsNonRefundable = (s: PreorderStoreSettings): boolean =>
  s.unpaidAction === 'cancel_keep'

const DAY_MS = 86_400_000

/** The date the balance must be paid by, when the store cancels unpaid balances. */
export function balancePayBy(s: PreorderStoreSettings, requestedAt: Date | null): Date | null {
  if (!requestedAt || s.unpaidAction === 'none') return null
  return new Date(requestedAt.getTime() + s.payWithinDays * DAY_MS)
}
