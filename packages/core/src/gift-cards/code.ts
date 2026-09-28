/** SOURCE OF TRUTH: gift card code normalising — WHAT: how a typed code is cleaned before lookup / WHY: the checkout field and the server must match codes the same way, and the field runs in the browser without zod */
/*
 * Gift card code handling with no zod, for the checkout's gift card field
 * (`@commerce/core/gift-card-code`); `./client` re-exports it.
 */

/** Upper-case and drop spaces and dashes, so "abcd-efgh 2345" and "ABCDEFGH2345" match. */
export function normaliseGiftCardCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
}
