import {
  ACCENT_COOKIE,
  ACCENT_COOKIE_MAX_AGE,
  accentCookieValue,
} from '@commerce/core/admin-accent'

/**
 * Caches the accent this member sees in the store, so the next server render of the admin
 * layout injects it without a query. Browser only.
 */
export function writeAccentCookie(organizationId: string, accent: string | null) {
  const value = encodeURIComponent(accentCookieValue(organizationId, accent))
  // biome-ignore lint/suspicious/noDocumentCookie: a plain first-party preference cookie.
  document.cookie = `${ACCENT_COOKIE}=${value}; path=/; max-age=${ACCENT_COOKIE_MAX_AGE}; samesite=lax`
}
