/** SOURCE OF TRUTH: SPLIT_TENDER_PROVIDERS, STORE_CREDIT_PROVIDER — WHAT: the payment providers that are not gateway attempts (gift cards, store credit) / WHY: attempts, expiry, retries and the one-capture rule must all skip the same rows, or a held store credit payment reads as a second gateway attempt */

/** A payment taken from the customer's store credit balance at checkout (not a gift card). */
export const STORE_CREDIT_PROVIDER = 'store_credit'

/**
 * Money spent beside the gateway at checkout: gift cards and store credit. These rows are never
 * gateway attempts: they are not retried, expired, asked about or counted as the one capture.
 * Pure strings, so this file has no imports and anything can use it.
 */
export const SPLIT_TENDER_PROVIDERS = ['gift_card', STORE_CREDIT_PROVIDER] as const

/** True for a gift card or store credit payment row. */
export const isSplitTender = (provider: string): boolean =>
  (SPLIT_TENDER_PROVIDERS as readonly string[]).includes(provider)
