import { CONSENT_COOKIE, decodeConsent } from '@commerce/core/consent'

/** Search & discovery events from the browser, sent through the page-view beacon. */
export type DiscoveryBeaconEvent =
  | { kind: 'search'; query: string; results: number }
  | { kind: 'impression'; source: 'related' | 'complementary'; handle: string }
  | { kind: 'click'; source: 'search' | 'related' | 'complementary'; handle: string; query?: string }

const BEACON_PATH = '/api/beacon'

/** The shopper said yes to analytics (the banner's cookie); the server checks again. */
function analyticsConsented(): boolean {
  if (typeof document === 'undefined') return false
  const raw = document.cookie
    .split('; ')
    .find((c) => c.startsWith(`${CONSENT_COOKIE}=`))
    ?.slice(CONSENT_COOKIE.length + 1)
  return decodeConsent(raw ? decodeURIComponent(raw) : null)?.analytics === true
}

/**
 * Sends one event, fire and forget: `sendBeacon` queues it without holding the page (a click
 * that navigates away still gets through), nothing is read back, and without consent nothing
 * is sent.
 */
export function sendDiscoveryEvent(event: DiscoveryBeaconEvent): void {
  if (typeof navigator === 'undefined' || !analyticsConsented()) return
  const body = JSON.stringify({ discovery: event })
  if (navigator.sendBeacon) {
    navigator.sendBeacon(BEACON_PATH, new Blob([body], { type: 'application/json' }))
    return
  }
  void fetch(BEACON_PATH, {
    method: 'POST',
    keepalive: true,
    headers: { 'content-type': 'application/json' },
    body,
  }).catch(() => undefined)
}
