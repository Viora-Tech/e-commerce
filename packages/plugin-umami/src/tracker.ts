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

/** The key Umami's tracker reads before every send: any value turns it off. */
export const UMAMI_DISABLED_KEY = 'umami.disabled'

/** What we write there, so a later yes clears only our own opt-out, never the merchant's. */
const CONSENT_OPT_OUT = 'consent'

type OptOutStorage = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

/**
 * Keeps Umami's own off switch in step with the cookie banner. Once loaded, the tracker counts
 * client-side page views by itself, so removing its script is not enough after a no: a no sets
 * `umami.disabled`, a yes clears it again unless the merchant set it (to leave out their own
 * visits). Blocked storage is ignored.
 */
export function syncUmamiOptOut(storage: OptOutStorage | null, allowed: boolean): void {
  if (!storage) return
  try {
    const current = storage.getItem(UMAMI_DISABLED_KEY)
    if (!allowed) {
      if (!current) storage.setItem(UMAMI_DISABLED_KEY, CONSENT_OPT_OUT)
      return
    }
    if (current === CONSENT_OPT_OUT) storage.removeItem(UMAMI_DISABLED_KEY)
  } catch {
    // Storage blocked: nothing loaded can be told; the next page load follows the banner.
  }
}
