'use server'

import 'server-only'

import { BackInStockError, createSignup } from '@commerce/plugin-back-in-stock'
import { headers } from 'next/headers'
import { clientIp, rateLimited, retryAfterSeconds } from './rate-limit'
import { requestStoreId } from './request-store'
import { inStore } from './store-context'

export type NotifyMeState = { status: 'idle' | 'done' | 'error'; error?: string }

/**
 * The "notify me" form's action; the variant id is bound by the caller, the store comes
 * from the hostname. Rate-limited per IP and per email so a scraper cannot spam
 * signups or bury the double-opt-in emails of a real shopper.
 */
export async function notifyMeAction(
  variantId: string,
  _state: NotifyMeState,
  form: FormData,
): Promise<NotifyMeState> {
  const storeId = await requestStoreId()
  const email = form.get('email')
  const phone = form.get('phone')
  if (typeof email !== 'string' && typeof phone !== 'string') {
    return { status: 'error', error: 'invalid' }
  }

  const ip = clientIp(await headers())
  const ipLimit = await rateLimited('back-in-stock:ip', ip, { limit: 10, windowMs: 60 * 60 * 1000 })
  if (!ipLimit.ok) return { status: 'error', error: `rate_limited:${retryAfterSeconds(ipLimit)}` }
  if (typeof email === 'string' && email) {
    const emailLimit = await rateLimited('back-in-stock:email', email.toLowerCase(), {
      limit: 5,
      windowMs: 60 * 60 * 1000,
    })
    if (!emailLimit.ok)
      return { status: 'error', error: `rate_limited:${retryAfterSeconds(emailLimit)}` }
  }

  try {
    await inStore(storeId, (tx) =>
      createSignup(tx, storeId, {
        variantId,
        email: typeof email === 'string' && email ? email : undefined,
        phone: typeof phone === 'string' && phone ? phone : undefined,
        ip,
      }),
    )
    return { status: 'done' }
  } catch (err) {
    if (err instanceof BackInStockError) return { status: 'error', error: err.code }
    return { status: 'error', error: 'unknown' }
  }
}
