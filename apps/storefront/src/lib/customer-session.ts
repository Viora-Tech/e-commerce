import 'server-only'
import { settingsSecret } from '@commerce/config'
import { customerForSession, type SignedInCustomer, safeNextPath } from '@commerce/core'
import { cookies, headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import { inStore } from './store-context'

/**
 * The shopper's session cookie. Host-only (no Domain), so each store's hostname
 * has its own; the token is looked up under that store's RLS scope, so a cookie
 * carried to another store resolves to nobody.
 */
export const CUSTOMER_COOKIE = 'wc_customer'

export async function readCustomerToken(): Promise<string | null> {
  return (await cookies()).get(CUSTOMER_COOKIE)?.value ?? null
}

/**
 * `persistent: false` ("Remember this device" unticked) writes a session cookie the
 * browser drops when it closes; the server-side session still expires on its own.
 */
export async function writeCustomerToken(
  token: string,
  expiresAt: Date,
  persistent = true,
): Promise<void> {
  const proto = (await headers()).get('x-forwarded-proto')
  ;(await cookies()).set(CUSTOMER_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    // Secure in production whatever the proxy forwards: a missing x-forwarded-proto must
    // never send a 90-day session cookie over plain http.
    secure: proto === 'https' || process.env.NODE_ENV === 'production',
    path: '/',
    ...(persistent ? { expires: expiresAt } : {}),
  })
}

export async function clearCustomerToken(): Promise<void> {
  ;(await cookies()).delete(CUSTOMER_COOKIE)
}

/** The signed-in shopper for this request, or null. Deduplicated per render. */
export const currentCustomer = cache(async (storeId: string): Promise<SignedInCustomer | null> => {
  const token = await readCustomerToken()
  if (!token) return null
  const secret = settingsSecret()
  return inStore(storeId, (tx) => customerForSession({ storeId, tx }, token, secret))
})

/** For account pages: the shopper, or a redirect to sign in that comes back here. */
export async function requireCustomer(
  storeId: string,
  returnTo: string,
): Promise<SignedInCustomer> {
  const me = await currentCustomer(storeId)
  if (!me) redirect(`/account/login?return_to=${encodeURIComponent(returnTo)}`)
  return me
}

/** Only same-site paths are followed after sign-in, never another origin. */
export function safeReturnTo(raw: unknown): string {
  return safeNextPath(raw)
}
