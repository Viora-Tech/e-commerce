/**
 * The thank-you page's small rules, kept pure so they are tested on their own: the shopper's
 * first name for the headline, the four-step progress bar (folded from the chat's five steps)
 * and one delivery window across the order's parcels.
 */
import type { ParcelDeliveryEstimate } from '@commerce/db'
import { formatDeliveryRange } from '@commerce/shipping'
import { type ChatOrderEnd, type ChatOrderProgressInput, chatOrderProgress } from './chat-track'

/** Confirmed → Packed → Shipped → Delivered; "out for delivery" reads as shipped. */
export const THANK_YOU_STEPS = ['confirmed', 'packed', 'shipped', 'delivered'] as const

export type ThankYouStep = (typeof THANK_YOU_STEPS)[number]

/** The progress bar's state: the furthest step reached, or the end state that replaces it. */
export type ThankYouProgress = { reached: number; end: null } | { reached: null; end: ChatOrderEnd }

/** The order's statuses as the page reads them; a draft counts as open. */
export type ThankYouProgressInput = Omit<ChatOrderProgressInput, 'status'> & {
  status: ChatOrderProgressInput['status'] | 'draft'
}

/** "Asha" from "Asha Verma"; null when there is no name to greet. */
export function firstName(name: string | null | undefined): string | null {
  const first = name?.trim().split(/\s+/)[0] ?? ''
  return first.length > 0 ? first : null
}

/** Index into `THANK_YOU_STEPS` of the step the order reached, or its end state. */
export function thankYouProgress(o: ThankYouProgressInput): ThankYouProgress {
  const { status, steps } = chatOrderProgress({
    ...o,
    status: o.status === 'draft' ? 'open' : o.status,
  })
  if (!steps) return { reached: null, end: status as ChatOrderEnd }
  const step = status === 'out_for_delivery' ? 'shipped' : (status as ThankYouStep)
  return { reached: THANK_YOU_STEPS.indexOf(step), end: null }
}

/**
 * "Tue, 18 Aug - Thu, 20 Aug": from the earliest parcel's first day to the latest parcel's last,
 * so the window covers the whole order. Null when no parcel has an estimate.
 */
export function deliveryWindow(
  estimates: readonly (ParcelDeliveryEstimate | null)[],
): string | null {
  const known = estimates.filter((e): e is ParcelDeliveryEstimate => e !== null)
  if (known.length === 0) return null
  // Civil dates (YYYY-MM-DD) sort as strings.
  const earliest = known.map((e) => e.earliest).sort()[0] as string
  const latest = known.map((e) => e.latest).sort()[known.length - 1] as string
  return formatDeliveryRange(earliest, latest)
}
