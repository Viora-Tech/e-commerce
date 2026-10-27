import 'server-only'
import { settingsSecret } from '@commerce/config'
import {
  type CheckoutPayload,
  signCheckoutSession,
  verifyCheckoutSession,
} from '@commerce/core/checkout-handoff'
import { cookies, headers } from 'next/headers'

/**
 * The checkout origin's session cookie (security audit D-01, phase B). Host-only (no `Domain`),
 * like `wc_customer`, so it lives only on `checkout.<primary>` and never reaches the store origin
 * or its theme code. Holds a signed {storeId, cartId, customerId} — the shopper's identity never
 * crosses as a readable cookie, only inside the signature.
 */
export const CHECKOUT_SESSION_COOKIE = 'wc_checkout'

export async function writeCheckoutSession(p: CheckoutPayload): Promise<void> {
  const proto = (await headers()).get('x-forwarded-proto')
  ;(await cookies()).set(CHECKOUT_SESSION_COOKIE, signCheckoutSession(p, settingsSecret()), {
    httpOnly: true,
    sameSite: 'lax',
    secure: proto === 'https' || process.env.NODE_ENV === 'production',
    path: '/',
  })
}

export async function readCheckoutSession(): Promise<CheckoutPayload | null> {
  const token = (await cookies()).get(CHECKOUT_SESSION_COOKIE)?.value
  if (!token) return null
  const v = verifyCheckoutSession(token, settingsSecret())
  return v.ok ? { storeId: v.storeId, cartId: v.cartId, customerId: v.customerId } : null
}

export async function clearCheckoutSession(): Promise<void> {
  ;(await cookies()).delete(CHECKOUT_SESSION_COOKIE)
}
