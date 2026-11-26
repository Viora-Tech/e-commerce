'use server'

import 'server-only'

import { revokeCustomerSession } from '@commerce/core'
import { affiliateForCustomer, updateAffiliateProfile } from '@commerce/plugin-affiliates/server'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { clearCustomerToken, currentCustomer, readCustomerToken } from './customer-session'
import { PORTAL_BASE_HEADER, PORTAL_PATH } from './portal-routing'
import { clientIp, rateLimited } from './rate-limit'
import { requestStoreId } from './request-store'
import { inStore } from './store-context'

/*
 * The affiliate portal's own actions (Settings › Profile, Log out). The store is the proxy's and
 * the affiliate is always the signed-in shopper's own record, never an id from the form. The
 * program's other actions (apply, payout details, code request) are in `affiliate-actions.ts`.
 */

const PROFILE_RULE = { limit: 20, windowMs: 60 * 60_000 }

export async function saveAffiliateProfileAction(input: {
  name: string
  social: string
}): Promise<{ ok: true } | { ok: false; error: 'name' | 'signin' | 'busy' | 'generic' }> {
  const storeId = await requestStoreId()
  const me = await currentCustomer(storeId)
  if (!me) return { ok: false, error: 'signin' }
  const name = String(input.name ?? '').trim()
  if (!name) return { ok: false, error: 'name' }
  const ip = clientIp(await headers())
  if (!(await rateLimited('affiliate-profile:ip', `${storeId}:${ip}`, PROFILE_RULE)).ok) {
    return { ok: false, error: 'busy' }
  }
  const saved = await inStore(storeId, async (tx) => {
    const row = await affiliateForCustomer(tx, storeId, me.id)
    if (!row) return false
    return updateAffiliateProfile(tx, row.id, { name, social: String(input.social ?? '') })
  })
  return saved ? { ok: true } : { ok: false, error: 'generic' }
}

/** Ends this browser's session on this host and goes back to the portal's sign-in page. */
export async function portalSignOutAction(): Promise<void> {
  const storeId = await requestStoreId()
  const token = await readCustomerToken()
  if (token) await inStore(storeId, (tx) => revokeCustomerSession({ storeId, tx }, token))
  await clearCustomerToken()
  const base = (await headers()).get(PORTAL_BASE_HEADER) ?? PORTAL_PATH
  redirect(`${base}/sign-in`)
}
