/** SOURCE OF TRUTH: return reason codes and labels — WHAT: the reasons a shopper can pick and their words / WHY: the storefront form, admin and emails show the same list, and the form runs in the browser without zod */
/*
 * Return reason codes and their shopper-facing words. No zod and no database, for
 * client components (`@commerce/core/return-reasons`); `./policy` re-exports all of it.
 */

/** Reason codes, in the order the shopper sees them. Words are plain on purpose. */
export const RETURN_REASONS = [
  'damaged',
  'wrong_item',
  'not_as_described',
  'quality',
  'size',
  'changed_mind',
  'other',
] as const
export type ReturnReason = (typeof RETURN_REASONS)[number]

export const RETURN_REASON_LABELS: Record<ReturnReason, string> = {
  damaged: 'It arrived damaged or broken',
  wrong_item: 'I got the wrong item',
  not_as_described: 'It does not match the photos or description',
  quality: 'The quality is not good',
  size: 'Wrong size',
  changed_mind: 'I changed my mind',
  other: 'Something else',
}
