/** SOURCE OF TRUTH: unpaid checkouts as drafts, on or off — WHAT: `checkoutDraftsOn` (the store's switch, the platform default and the global kill switch) and the hold windows a checkout draft keeps its stock for / WHY: one reader decides whether an unpaid checkout is a draft (#D57) or a numbered order, so a rolling deploy can keep it off everywhere (docs/design/unpaid-checkouts-as-drafts.md, R2) */
import { manualCancelHoursOf, type PaymentSettings } from './settings'
import { isSplitTender } from './split-tender'

/**
 * What a store that never chose gets: on for every store (owner, 9 Nov 2026). It was off until
 * every part of the feature had merged (the design's R2: an older worker would apply a payment
 * to a draft without converting it). `CHECKOUT_DRAFTS=off` still turns it off everywhere.
 */
export const CHECKOUT_DRAFTS_DEFAULT: boolean = true

/**
 * The global kill switch: `CHECKOUT_DRAFTS=off` in the app and worker environment makes every
 * new unpaid checkout a numbered order again, whatever the stores chose. Drafts already saved
 * still convert when they are paid.
 */
function checkoutDraftsKilled(env: Record<string, string | undefined> = process.env) {
  return env.CHECKOUT_DRAFTS?.trim().toLowerCase() === 'off'
}

/** Whether this store keeps new unpaid checkouts as drafts. */
export function checkoutDraftsOn(
  s: Pick<PaymentSettings, 'unpaidAsDrafts'>,
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (checkoutDraftsKilled(env)) return false
  if (s.unpaidAsDrafts === 'on') return true
  if (s.unpaidAsDrafts === 'off') return false
  return CHECKOUT_DRAFTS_DEFAULT
}

/**
 * Payment methods whose unpaid checkout becomes a draft: every online gateway (built in or an
 * app's) and the manual UPI / bank transfer. Cash on delivery is an order at once (nothing is
 * paid before delivery), and so is anything gift cards or store credit settle.
 */
export const draftsForMethod = (providerId: string): boolean =>
  providerId !== 'cod' && !isSplitTender(providerId)

/** A checkout draft's stock is held this long when the store has no unpaid window. */
const ONLINE_HOLD_DEFAULT_MINUTES = 30
/** A transfer draft's stock is held this long when the store does not cancel transfers. */
const MANUAL_HOLD_DEFAULT_HOURS = 48

/**
 * How long, in minutes, a new checkout draft holds its items: the store's "cancel unpaid orders
 * after" window for an online payment (30 minutes by default), the transfer window for UPI /
 * bank transfer (48 hours when transfers are never cancelled). After that the draft stays,
 * payable, but holds nothing; paying it reserves the stock again.
 */
export function draftHoldMinutes(
  s: Pick<
    PaymentSettings,
    'expireUnpaidAfterMinutes' | 'manualAutoCancel' | 'manualCancelAfterHours'
  >,
  providerId: string,
): number {
  if (providerId === 'manual') {
    return (manualCancelHoursOf(s) || MANUAL_HOLD_DEFAULT_HOURS) * 60
  }
  return s.expireUnpaidAfterMinutes || ONLINE_HOLD_DEFAULT_MINUTES
}

/** Checkout drafts stop waiting for payment after this many days unpaid (owner, Q4). */
export const CHECKOUT_DRAFT_EXPIRY_DAYS = 7
