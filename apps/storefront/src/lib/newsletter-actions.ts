'use server'

import type { NewsletterState } from '@commerce/blocks/puck'
import { subscribeToNewsletter } from '@commerce/core'
import { inStore } from './store-context'

/** The email signup section's form action; the store id is bound by the template renderer. */
export async function subscribeAction(
  storeId: string,
  _state: NewsletterState,
  form: FormData,
): Promise<NewsletterState> {
  if (typeof storeId !== 'string') return { status: 'error' }
  const ok = await inStore(storeId, (tx) => subscribeToNewsletter(tx, storeId, form.get('email')))
  return { status: ok ? 'done' : 'error' }
}
