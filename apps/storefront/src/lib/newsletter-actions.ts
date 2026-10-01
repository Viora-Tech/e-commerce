'use server'

import 'server-only'

import type { NewsletterState } from '@commerce/blocks/puck'
import { loadEnv } from '@commerce/config'
import { enrolSubscriber, subscribeToNewsletter } from '@commerce/core'
import { headers } from 'next/headers'
import { clientIp, rateLimited } from './rate-limit'
import { inStore } from './store-context'

/** Per IP: a person signs up once or twice, never dozens of addresses a minute. */
const NEWSLETTER_IP_RULE = { limit: 10, windowMs: 10 * 60_000 }

/**
 * The email signup section's form action; the store id is bound by the
 * template renderer. A signup records consent on the customer and starts the
 * welcome automation, once per customer.
 */
export async function subscribeAction(
  _state: NewsletterState,
  form: FormData,
): Promise<NewsletterState> {
  // The store the hostname resolved to: a signup cannot be aimed at another store's list.
  const h = await headers()
  const storeId = h.get('x-store-id')
  if (!storeId) return { status: 'error' }
  const limit = await rateLimited('newsletter:ip', clientIp(h), NEWSLETTER_IP_RULE)
  if (!limit.ok) return { status: 'error' }
  const email = form.get('email')
  const ok = await inStore(storeId, async (tx) => {
    const subscribed = await subscribeToNewsletter(tx, storeId, email)
    if (subscribed && typeof email === 'string') {
      await enrolSubscriber(tx, storeId, email, loadEnv(process.env).SETTINGS_SECRET)
    }
    return subscribed
  })
  return { status: ok ? 'done' : 'error' }
}
