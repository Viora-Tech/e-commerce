'use server'

import type { NewsletterState } from '@commerce/blocks/puck'
import { enrolSubscriber, subscribeToNewsletter } from '@commerce/core'
import { inStore } from './store-context'

/**
 * The email signup section's form action; the store id is bound by the
 * template renderer. A signup records consent on the customer and starts the
 * welcome automation, once per customer.
 */
export async function subscribeAction(
  storeId: string,
  _state: NewsletterState,
  form: FormData,
): Promise<NewsletterState> {
  if (typeof storeId !== 'string') return { status: 'error' }
  const email = form.get('email')
  const ok = await inStore(storeId, async (tx) => {
    const subscribed = await subscribeToNewsletter(tx, storeId, email)
    if (subscribed && typeof email === 'string') await enrolSubscriber(tx, storeId, email)
    return subscribed
  })
  return { status: ok ? 'done' : 'error' }
}
