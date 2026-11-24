/** SOURCE OF TRUTH: the storefront side of the hourly cap of unpaid checkouts — WHAT: the checkout device cookie kept on the order, and the per-IP bot guard / WHY: owner decision 24 Nov 2026, 5 unpaid checkouts an hour per shopper by email, phone or device (placeOrder counts those), so new contact details on one phone still trip it */
import 'server-only'

import { randomUUID } from 'node:crypto'
import { unpaidCheckoutsPerHourOf } from '@commerce/core'
import { cookies } from 'next/headers'
import { rateLimited } from './rate-limit'
import { inStore } from './store-context'

export const CHECKOUT_DEVICE_COOKIE = 'wc_ckd'
const ONE_YEAR_S = 60 * 60 * 24 * 365
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Unpaid checkouts one IP may start in an hour: high enough for a shared mobile-network IP. */
const IP_UNPAID_CHECKOUTS_PER_HOUR = 20
const UNPAID_CHECKOUT_WINDOW_MS = 3_600_000

/** Our own id, or null for anything else (a tampered value is treated as a new device). */
export function parseCheckoutDeviceId(value: string | undefined): string | null {
  return value && UUID.test(value) ? value : null
}

/**
 * This browser's checkout device id, set on its first checkout. A fraud guard the checkout
 * needs, never analytics, so it does not wait for cookie consent. Server actions only (it may
 * write the cookie).
 */
export async function checkoutDeviceId(): Promise<string> {
  const jar = await cookies()
  const known = parseCheckoutDeviceId(jar.get(CHECKOUT_DEVICE_COOKIE)?.value)
  if (known) return known
  const id = randomUUID()
  jar.set(CHECKOUT_DEVICE_COOKIE, id, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: ONE_YEAR_S,
  })
  return id
}

/**
 * Too many unpaid checkouts from one IP in an hour (the email, phone and device count is
 * placeOrder's, at the store's cap). Indian mobile networks put many shoppers behind one IP, so
 * the IP cap is a fixed bot guard, on whenever the store's cap is on. Cash on delivery is never
 * counted: it is unpaid until the parcel arrives.
 */
export async function tooManyUnpaidFromIp(
  storeId: string,
  ip: string,
  payment: string,
): Promise<boolean> {
  if (payment === 'cod') return false
  const cap = await inStore(storeId, (tx) => unpaidCheckoutsPerHourOf({ storeId, tx }))
  if (cap <= 0) return false
  const rule = { limit: IP_UNPAID_CHECKOUTS_PER_HOUR, windowMs: UNPAID_CHECKOUT_WINDOW_MS }
  return !(await rateLimited('unpaid-checkout:ip', `${storeId}:${ip}`, rule)).ok
}
