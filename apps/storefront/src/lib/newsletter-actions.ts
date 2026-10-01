'use server'

import 'server-only'

import type { NewsletterState } from '@commerce/blocks/puck'
import { settingsSecret } from '@commerce/config'
import { confirmNewsletterSignup, enrolSubscriber, requestNewsletterSignup } from '@commerce/core'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { nudgeOutbox } from './outbox'
import { clientIp, rateLimited } from './rate-limit'
import { requestStoreId } from './request-store'
import { inStore } from './store-context'

/** Per IP: a person signs up once or twice, never dozens of addresses a minute. */
const NEWSLETTER_IP_RULE = { limit: 10, windowMs: 10 * 60_000 }
/** Per address: a typed address gets a handful of confirm emails a day at most. */
const NEWSLETTER_EMAIL_RULE = { limit: 3, windowMs: 24 * 60 * 60_000 }

/**
 * The email signup section's form action (double opt-in, security audit D-09). It only
 * records a pending signup and queues the confirm email; the address gets marketing
 * consent, and the welcome automation starts, when the link is confirmed. The store is
 * the one the hostname resolved to, so a signup cannot be aimed at another store's list.
 */
export async function subscribeAction(
  _state: NewsletterState,
  form: FormData,
): Promise<NewsletterState> {
  const h = await headers()
  const storeId = h.get('x-store-id')
  if (!storeId) return { status: 'error' }
  const email = form.get('email')
  const byIp = await rateLimited('newsletter:ip', clientIp(h), NEWSLETTER_IP_RULE)
  if (!byIp.ok) return { status: 'error' }
  if (typeof email === 'string') {
    const key = `${storeId}:${email.trim().toLowerCase()}`
    const byEmail = await rateLimited('newsletter:email', key, NEWSLETTER_EMAIL_RULE)
    // Say "check your inbox" either way: the form must not reveal who already signed up.
    if (!byEmail.ok) return { status: 'done' }
  }
  const result = await inStore(storeId, (tx) => requestNewsletterSignup(tx, storeId, email))
  if (result === 'invalid') return { status: 'error' }
  if (result === 'sent') await nudgeOutbox(storeId)
  return { status: 'done' }
}

/**
 * The confirm page's button: consent, the newsletter tag and the welcome automation. The
 * page then shows the confirmed state; a bad or expired token changes nothing.
 */
export async function confirmNewsletterAction(token: string): Promise<void> {
  const storeId = await requestStoreId()
  const secret = settingsSecret()
  await inStore(storeId, async (tx) => {
    const confirmed = await confirmNewsletterSignup(tx, storeId, token, secret)
    if (confirmed.ok && !confirmed.alreadyConfirmed) {
      await enrolSubscriber(tx, storeId, confirmed.email, secret)
    }
  })
  revalidatePath(`/newsletter/confirm/${token}`)
}
