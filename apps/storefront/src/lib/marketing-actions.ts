'use server'

import 'server-only'

import { loadEnv } from '@commerce/config'
import { resubscribeCustomer, unsubscribeCustomer, verifyUnsubscribeToken } from '@commerce/core'
import { revalidatePath } from 'next/cache'
import { requestStoreId } from './request-store'
import { inStore } from './store-context'

/**
 * The unsubscribe page's buttons. The token names the store and customer and
 * is checked against the store the request's hostname resolves to, so a link
 * from one store can never change a customer of another.
 */
async function withToken(
  token: string,
  fn: (storeId: string, customerId: string) => Promise<unknown>,
) {
  const storeId = await requestStoreId()
  const v = verifyUnsubscribeToken(token, loadEnv(process.env).SETTINGS_SECRET)
  if (!v || v.storeId !== storeId) return
  await fn(storeId, v.customerId)
  revalidatePath(`/unsubscribe/${token}`)
}

export async function unsubscribeAction(token: string) {
  await withToken(token, (storeId, customerId) =>
    inStore(storeId, (tx) => unsubscribeCustomer(tx, customerId)),
  )
}

export async function resubscribeAction(token: string) {
  await withToken(token, (storeId, customerId) =>
    inStore(storeId, (tx) => resubscribeCustomer(tx, customerId)),
  )
}
