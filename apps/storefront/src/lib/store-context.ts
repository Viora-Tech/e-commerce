import { type StoreTx, withStore } from '@commerce/db'
import { headers } from 'next/headers'
import { db } from './db'

export const STORE_HEADER = 'x-store-id'

/** The store id the proxy resolved for this request. Throws if the proxy did not run. */
export async function currentStoreId(): Promise<string> {
  const id = (await headers()).get(STORE_HEADER)
  if (!id) throw new Error('No store on request; proxy.ts must set x-store-id')
  return id
}

/** Run a query scoped to the request's store. The only way pages should touch the database. */
export async function inStore<T>(fn: (tx: StoreTx, storeId: string) => Promise<T>): Promise<T> {
  const storeId = await currentStoreId()
  return withStore(db(), storeId, (tx) => fn(tx, storeId))
}
