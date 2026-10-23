'use server'

import 'server-only'

import { settingsSecret } from '@commerce/config'
import {
  affiliateForCustomer,
  affiliateState,
  applyAsAffiliate,
  type PayoutDetails,
  PayoutDetailsSchema,
  savePayoutDetails,
} from '@commerce/plugin-affiliates/server'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { currentCustomer } from './customer-session'
import { clientIp, rateLimited } from './rate-limit'
import { requestStoreId } from './request-store'
import { inStore } from './store-context'

/*
 * The affiliate portal's actions (`/affiliate`). The store is the one the hostname resolved
 * to and the affiliate is always the signed-in shopper's own record, never an id from the
 * form. Payout details are encrypted before they are saved and never logged.
 */

export type AffiliateActionResult = { ok: true } | { ok: false; error: string }

const APPLY_RULE = { limit: 5, windowMs: 60 * 60_000 }
const PAYOUT_RULE = { limit: 10, windowMs: 60 * 60_000 }

async function ipKey(storeId: string): Promise<string> {
  return `${storeId}:${clientIp(await headers())}`
}

export async function applyAffiliateAction(input: {
  name: string
  social: string
  message: string
  acceptTerms: boolean
}): Promise<AffiliateActionResult> {
  const storeId = await requestStoreId()
  const me = await currentCustomer(storeId)
  if (!me) return { ok: false, error: 'signin' }
  if (!input.acceptTerms) return { ok: false, error: 'terms' }
  const name = String(input.name ?? '').trim()
  if (!name) return { ok: false, error: 'name' }
  if (!(await rateLimited('affiliate-apply:ip', await ipKey(storeId), APPLY_RULE)).ok) {
    return { ok: false, error: 'busy' }
  }
  const result = await inStore(storeId, async (tx) => {
    const { installed, settings } = await affiliateState(tx, storeId)
    if (!installed || !settings.active) return 'closed' as const
    await applyAsAffiliate(
      tx,
      storeId,
      {
        customerId: me.id,
        email: me.email,
        phone: me.phone,
        name,
        social: String(input.social ?? ''),
        message: String(input.message ?? ''),
      },
      settings,
      settingsSecret(),
    )
    return 'ok' as const
  })
  if (result !== 'ok') return { ok: false, error: result }
  revalidatePath('/affiliate')
  return { ok: true }
}

export async function savePayoutDetailsAction(
  input: PayoutDetails,
): Promise<AffiliateActionResult & { field?: string }> {
  const storeId = await requestStoreId()
  const me = await currentCustomer(storeId)
  if (!me) return { ok: false, error: 'signin' }
  const parsed = PayoutDetailsSchema.safeParse(input)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return { ok: false, error: 'invalid', field: String(issue?.path[0] ?? '') }
  }
  if (!(await rateLimited('affiliate-payout:ip', await ipKey(storeId), PAYOUT_RULE)).ok) {
    return { ok: false, error: 'busy' }
  }
  const saved = await inStore(storeId, async (tx) => {
    const row = await affiliateForCustomer(tx, storeId, me.id)
    if (row?.status !== 'approved') return false
    await savePayoutDetails(tx, row.id, parsed.data, settingsSecret())
    return true
  })
  if (!saved) return { ok: false, error: 'not_affiliate' }
  revalidatePath('/affiliate')
  return { ok: true }
}
