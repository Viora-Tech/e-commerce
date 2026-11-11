/**
 * An affiliate link (`?ref=`) opened before the shopper said yes to marketing cookies sets no
 * referral cookie (owner, 12 Nov 2026). The consent banner keeps the landing in this tab's
 * session storage, so a yes later in the visit can still set it (`/api/referral`). Browser
 * code; nothing here is sent anywhere until that yes.
 */

export const PENDING_REFERRAL_KEY = 'wc_ref_pending'

/** What the tab keeps: the ref as it was in the link, and when the page was opened (ms). */
export type PendingReferral = { code: string; at: number }

type TabStorage = {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

/** Keeps this page's `?ref=` with the time; a page without one leaves an earlier landing alone. */
export function keepPendingReferral(storage: TabStorage | null, search: string, now: Date): void {
  const code = new URLSearchParams(search).get('ref')?.trim().slice(0, 64)
  if (!storage || !code) return
  try {
    storage.setItem(PENDING_REFERRAL_KEY, JSON.stringify({ code, at: now.getTime() }))
  } catch {
    // Storage blocked: a later yes cannot credit this link; a coupon code still can.
  }
}

/** The kept landing, removed as it is read (it is used once), or null. */
export function takePendingReferral(storage: TabStorage | null): PendingReferral | null {
  if (!storage) return null
  try {
    const raw = storage.getItem(PENDING_REFERRAL_KEY)
    if (raw === null) return null
    storage.removeItem(PENDING_REFERRAL_KEY)
    const parsed = JSON.parse(raw) as Partial<PendingReferral>
    return typeof parsed.code === 'string' && typeof parsed.at === 'number'
      ? { code: parsed.code, at: parsed.at }
      : null
  } catch {
    return null
  }
}
