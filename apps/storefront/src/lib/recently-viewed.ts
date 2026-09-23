/** Cookie the product page appends its handle to; the Recently viewed section reads it. */
export const RECENTLY_VIEWED_COOKIE = 'recently_viewed'
export const RECENTLY_VIEWED_MAX = 12

const HANDLE = /^[a-z0-9-]{1,120}$/

/** Handles, newest first, from the cookie value; anything malformed is dropped. */
export function parseRecentlyViewed(value: string | undefined): string[] {
  if (!value) return []
  return decodeURIComponent(value)
    .split(',')
    .filter((h) => HANDLE.test(h))
    .slice(0, RECENTLY_VIEWED_MAX)
}

/** The cookie value after viewing `handle`: moved to the front, capped. */
export function withViewed(value: string | undefined, handle: string): string {
  const rest = parseRecentlyViewed(value).filter((h) => h !== handle)
  return [handle, ...rest].slice(0, RECENTLY_VIEWED_MAX).join(',')
}
