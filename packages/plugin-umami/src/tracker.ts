/** SOURCE OF TRUTH: the Umami tracker as the storefront's browser code reads it — WHAT: the tracker shape and whether it may run for this shopper / WHY: kept apart from `settings.ts`, whose zod schemas would otherwise ship to every storefront page through the consent manager */

/** What the storefront needs to load the tracker. */
export type UmamiTracker = { src: string; websiteId: string; waitForConsent: boolean }

/**
 * Whether the tracker runs for this shopper: after a yes to analytics, or, when the store does
 * not wait for consent, until the shopper says no (`consent` null = not answered yet).
 */
export function umamiAllowed(
  tracker: UmamiTracker,
  consent: { analytics: boolean } | null,
): boolean {
  if (consent) return consent.analytics
  return !tracker.waitForConsent
}
