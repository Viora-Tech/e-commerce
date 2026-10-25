'use server'

import 'server-only'

import type { CardProduct } from '@commerce/blocks'
import { listCardProducts } from './catalog'
import { requestStoreId } from './request-store'
import { inStore } from './store-context'

/** The most a wishlist page asks for at once; the device list is capped at the same size. */
const MAX_HANDLES = 100

/** The cards for the handles a shopper saved on this device, in their order; unknown ones drop. */
export async function wishlistCardsAction(handles: string[]): Promise<CardProduct[]> {
  const clean = [...new Set(handles.filter((h) => typeof h === 'string' && h.length <= 255))]
  if (clean.length === 0) return []
  const storeId = await requestStoreId()
  return inStore(storeId, (tx) =>
    listCardProducts(tx, MAX_HANDLES, undefined, clean.slice(0, MAX_HANDLES)),
  )
}
