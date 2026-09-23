'use server'

import { loadEnv } from '@commerce/config'
import { resubscribeCustomer, unsubscribeCustomer, verifyUnsubscribeToken } from '@commerce/core'
import { revalidatePath } from 'next/cache'
import { inStore } from './store-context'

/**
 * The unsubscribe page's buttons. The token names the store and customer and
 * is checked against the store the page is served for, so a link from one
 * store can never change a customer of another.
 */
async function withToken(
  storeId: string,
  token: string,
  fn: (customerId: string) => Promise<unknown>,
): Promise<void> {
  const v = verifyUnsubscribeToken(token, loadEnv(process.env).SETTINGS_SECRET)
  if (!v || v.storeId !== storeId) return
  await fn(v.customerId)
  revalidatePath(`/unsubscribe/${token}`)
}

export async function unsubscribeAction(storeId: string, token: string) {
  await withToken(storeId, token, (customerId) =>
    inStore(storeId, (tx) => unsubscribeCustomer(tx, customerId)),
  )
}

export async function resubscribeAction(storeId: string, token: string) {
  await withToken(storeId, token, (customerId) =>
    inStore(storeId, (tx) => resubscribeCustomer(tx, customerId)),
  )
}
