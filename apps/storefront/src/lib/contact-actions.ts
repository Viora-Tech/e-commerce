import 'server-only'
import { parseContactForm, saveContactMessage } from '@commerce/plugin-forms/server'
import { headers } from 'next/headers'
import { formsInstalled } from './forms-context'
import { nudgeOutbox } from './outbox'
import { clientIp, rateLimited } from './rate-limit'
import { requestStoreId } from './request-store'
import { inStore } from './store-context'

/** Per IP and store: a person writes a few messages, a script writes hundreds. */
const CONTACT_RULE = { limit: 5, windowMs: 10 * 60_000 }

/** The hidden field our form tag adds; a person never fills it (see `engine.ts` FormTag). */
export const HONEYPOT_FIELD = 'contact_website'

export type ContactOutcome = 'posted' | 'invalid' | 'limited' | 'unavailable'

/**
 * A theme's `{% form 'contact' %}` post (Forms app). The store is the one the hostname
 * resolved to (`x-store-id`), never anything in the body. A filled honeypot answers
 * "posted" without saving, so a bot learns nothing. Saved, then the store is emailed
 * through the outbox.
 */
export async function submitContact(form: FormData, path: string): Promise<ContactOutcome> {
  const storeId = await requestStoreId()
  const byIp = await rateLimited(
    'contact:ip',
    `${storeId}:${clientIp(await headers())}`,
    CONTACT_RULE,
  )
  if (!byIp.ok) return 'limited'
  if (!(await inStore(storeId, (tx) => formsInstalled(tx, storeId)))) return 'unavailable'
  const filled = form.get(HONEYPOT_FIELD)
  if (typeof filled === 'string' && filled.trim() !== '') return 'posted'
  const parsed = parseContactForm(form)
  if (!parsed.ok) return 'invalid'
  await inStore(storeId, (tx) => saveContactMessage(tx, storeId, { ...parsed.value, path }))
  await nudgeOutbox(storeId)
  return 'posted'
}
