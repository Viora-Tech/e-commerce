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

/** A reason the merchant wrote (Settings › Returns) is stored as `custom:<their words>` (#180). */
export const CUSTOM_REASON_PREFIX = 'custom:'
export const MAX_CUSTOM_REASONS = 8
export const CUSTOM_REASON_MAX_LENGTH = 60

export const customReasonCode = (label: string) => `${CUSTOM_REASON_PREFIX}${label.trim()}`

/** The words for a stored reason: the merchant's own, the built-in label, or the raw value. */
export function returnReasonLabel(
  reason: string,
  labels: Record<ReturnReason, string> = RETURN_REASON_LABELS,
): string {
  if (reason.startsWith(CUSTOM_REASON_PREFIX)) return reason.slice(CUSTOM_REASON_PREFIX.length)
  return labels[reason as ReturnReason] ?? reason
}
