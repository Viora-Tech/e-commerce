'use client'

import { createMerchantAuthClient } from '@commerce/auth/client'

export const authClient = createMerchantAuthClient('')

/** Better Auth's client errors carry a `code` only on some paths ("AUTH_CANCELLED"). */
export function authErrorCode(error: object): string {
  return 'code' in error && typeof error.code === 'string' ? error.code : ''
}

/**
 * Where a sign-in goes next. An API route (finishing a Shopify install started while signed
 * out) needs a full page load: the client router cannot follow a route handler's redirect.
 */
export function goAfterSignIn(
  router: { push: (href: string) => void; refresh: () => void },
  next: string | null,
  home: string,
) {
  if (next?.startsWith('/api/')) return window.location.assign(next)
  router.push(next ?? home)
  router.refresh()
}
