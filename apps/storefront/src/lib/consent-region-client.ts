import {
  type ConsentRegion,
  REGION_CHECK_TIMEOUT_MS,
  REGION_FALLBACK,
} from '@commerce/core/consent'

/**
 * The browser side of a page drawn without the visitor's consent region (a copy a shared cache
 * may keep, `x-consent-pending`): asks `/api/consent-region` once per tab and keeps the answer
 * for the tab's later pages. The plain HTML island does the same in its own script
 * (`lib/plain-html/islands.ts`).
 */

export const REGION_KEY = 'wc_consent_region'

function tabStorage(): Storage | null {
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

function isRegion(value: unknown): value is ConsentRegion {
  return value === 'open' || value === 'ask'
}

/** The region this tab already learned, or null. */
export function knownRegion(): ConsentRegion | null {
  const saved = tabStorage()?.getItem(REGION_KEY)
  return isRegion(saved) ? saved : null
}

/**
 * The visitor's region. When the check fails, answers something else or takes longer than
 * `REGION_CHECK_TIMEOUT_MS`, `REGION_FALLBACK` (`open`: no banner); that guess is not saved, so
 * the tab's next page asks again.
 */
export async function fetchRegion(): Promise<ConsentRegion> {
  const known = knownRegion()
  if (known) return known
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REGION_CHECK_TIMEOUT_MS)
  try {
    const res = await fetch('/api/consent-region', {
      credentials: 'same-origin',
      signal: controller.signal,
    })
    if (!res.ok) return REGION_FALLBACK
    const body = (await res.json()) as { region?: unknown }
    if (!isRegion(body.region)) return REGION_FALLBACK
    try {
      tabStorage()?.setItem(REGION_KEY, body.region)
    } catch {
      // Blocked storage: the next page asks again.
    }
    return body.region
  } catch {
    return REGION_FALLBACK
  } finally {
    clearTimeout(timer)
  }
}

declare global {
  interface Window {
    /** The consent that counts on this page now, for code outside React (`discovery-beacon.ts`). */
    __commerceConsent?: { analytics: boolean; marketing: boolean } | null
  }
}
