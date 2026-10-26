'use server'

import 'server-only'

import { settingsSecret } from '@commerce/config'
import { orderViewToken, thankYouPath } from '@commerce/core'
import { order } from '@commerce/db'
import { eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { redirectToOrderPage } from './order-view-cookie'
import { clientIp, rateLimited } from './rate-limit'
import { requestStoreId } from './request-store'
import { inStore } from './store-context'
import { contactMatches, orderNumberFrom } from './track-order'

export type TrackOrderState = { status: 'idle' | 'not-found' | 'limited' }

/** A few honest typos a minute; enough to stop anyone walking the order numbers. */
const LOOKUP_IP_RULE = { limit: 10, windowMs: 60_000 }

/**
 * Finds an order by its number and the email or mobile it was placed with, and opens its status
 * page through a signed, per-order link. A wrong pair says only "not found", whichever half was
 * wrong, so the form cannot be used to learn which numbers exist.
 */
export async function trackOrderAction(
  _state: TrackOrderState,
  form: FormData,
): Promise<TrackOrderState> {
  const storeId = await requestStoreId()
  const limit = await rateLimited('track-order:ip', clientIp(await headers()), LOOKUP_IP_RULE)
  if (!limit.ok) return { status: 'limited' }

  const number = orderNumberFrom(String(form.get('number') ?? ''))
  const contact = String(form.get('contact') ?? '')
  if (number === null || !contact.trim()) return { status: 'not-found' }

  const found = await inStore(storeId, async (tx) => {
    const [o] = await tx
      .select({ id: order.id, email: order.email, phone: order.phone })
      .from(order)
      .where(eq(order.number, number))
    return o && contactMatches(contact, o) ? o.id : null
  })
  if (!found) return { status: 'not-found' }
  return redirectToOrderPage(thankYouPath(number, orderViewToken(found, settingsSecret())))
}
