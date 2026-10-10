'use server'

import 'server-only'

import { settingsSecret } from '@commerce/config'
import { openUnsubscribeToken, optOutOfReviewEmails } from '@commerce/plugin-reviews/server'
import { redirect } from 'next/navigation'
import { requestStoreId } from './request-store'
import { inStore } from './store-context'

/**
 * The stop-review-emails button (Reviews app). The signed link names the store and the
 * review request; it is checked against the store the hostname resolves to, so a link from
 * one store never changes another's.
 */
export async function stopReviewEmailsAction(token: string) {
  const storeId = await requestStoreId()
  const requestId = openUnsubscribeToken(settingsSecret(), token, storeId)
  if (requestId) await inStore(storeId, (tx) => optOutOfReviewEmails(tx, requestId))
  redirect(`/reviews/unsubscribe?t=${encodeURIComponent(token)}&done=1`)
}
