export type ConsentChoice = { analytics: boolean; marketing: boolean }

export const CONSENT_COOKIE = 'cookie_consent'
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365
const CHANGE_EVENT = 'consent-change'

/** Essential only: the default until a visitor chooses. */
export const ESSENTIAL_ONLY: ConsentChoice = { analytics: false, marketing: false }
export const ACCEPT_ALL: ConsentChoice = { analytics: true, marketing: true }

export function readConsentCookie(cookieString: string): string {
  const match = cookieString.split('; ').find((part) => part.startsWith(`${CONSENT_COOKIE}=`))
  return match ? match.slice(CONSENT_COOKIE.length + 1) : ''
}

export function parseConsent(raw: string): ConsentChoice | null {
  if (!raw) return null
  try {
    const value: unknown = JSON.parse(decodeURIComponent(raw))
    if (typeof value !== 'object' || value === null) return null
    const { analytics, marketing } = value as Record<string, unknown>
    return { analytics: analytics === true, marketing: marketing === true }
  } catch {
    return null
  }
}

export function writeConsent(choice: ConsentChoice): void {
  const value = encodeURIComponent(JSON.stringify(choice))
  // biome-ignore lint/suspicious/noDocumentCookie: the consent choice is a first-party cookie, set from the banner
  document.cookie = `${CONSENT_COOKIE}=${value}; path=/; max-age=${ONE_YEAR_SECONDS}; SameSite=Lax`
  window.dispatchEvent(new Event(CHANGE_EVENT))
}

export function subscribeConsent(onChange: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, onChange)
  return () => window.removeEventListener(CHANGE_EVENT, onChange)
}

export function getConsentSnapshot(): string {
  return readConsentCookie(document.cookie)
}

/** Server snapshot: unknown, so the banner never renders before the browser has read the cookie. */
export const CONSENT_UNKNOWN = '?'
export function getConsentServerSnapshot(): string {
  return CONSENT_UNKNOWN
}
