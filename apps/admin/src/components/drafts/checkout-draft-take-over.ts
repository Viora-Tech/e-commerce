import type { TakeOverRefusal } from '@commerce/core'

/** The reasons `orders.takeOverCheckoutDraft` refuses with (core's `TAKE_OVER_REFUSALS`). */
const REFUSALS: readonly TakeOverRefusal[] = [
  'not_found',
  'not_checkout',
  'paid',
  'in_progress',
  'shopper_paid',
  'split_tender',
  'unchecked',
]

/**
 * Why the API refused "Edit" on a checkout draft (`data.reason` on its 404 / 409), or null for
 * any other error, so the button can say it in the member's language.
 */
export function takeOverRefusal(err: unknown): TakeOverRefusal | null {
  const reason = (err as { data?: { reason?: unknown } } | null)?.data?.reason
  return REFUSALS.find((r) => r === reason) ?? null
}
