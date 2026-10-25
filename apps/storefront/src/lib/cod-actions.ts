'use server'

import 'server-only'

import { settingsSecret } from '@commerce/config'
import { answerCodConfirmation } from '@commerce/core'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { nudgeOutbox } from './outbox'
import { clientIp, rateLimited } from './rate-limit'
import { requestStoreId } from './request-store'
import { inStore } from './store-context'

/** A shopper answers once or twice; the limit only stops a script hammering one link. */
const COD_ANSWER_RULE = { limit: 10, windowMs: 10 * 60_000 }

/**
 * The COD confirm page's two buttons (COD & RTO app). The token names the order and is
 * checked again here; the store is the one the hostname resolved to. A cancel cancels the
 * order (its stock goes back), so the outbox is woken for the cancellation message.
 */
export async function answerCodAction(token: string, answer: 'confirm' | 'cancel') {
  const storeId = await requestStoreId()
  const limit = await rateLimited('cod-answer:ip', clientIp(await headers()), COD_ANSWER_RULE)
  if (!limit.ok) redirect(`/cod/${encodeURIComponent(token)}`)
  const result = await inStore(storeId, (tx) =>
    answerCodConfirmation({ storeId, tx }, token, settingsSecret(), answer),
  )
  if (result.ok && result.status === 'cancelled') await nudgeOutbox(storeId)
  const done = result.ok ? result.status : result.reason
  redirect(`/cod/${encodeURIComponent(token)}?done=${done}`)
}
