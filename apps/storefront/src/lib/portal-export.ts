import 'server-only'

import { type AffiliateRow, affiliateForCustomer } from '@commerce/plugin-affiliates/server'
import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { currentCustomer } from './customer-session'
import { inStore } from './store-context'

/**
 * The approved affiliate a portal export is for: the signed-in shopper's own record, on the store
 * the proxy resolved. Null for anyone else (the route answers 404).
 */
export async function exportingAffiliate(storeId: string): Promise<AffiliateRow | null> {
  if ((await headers()).get('x-store-id') !== storeId) return null
  const me = await currentCustomer(storeId)
  if (!me) return null
  const row = await inStore(storeId, (tx) => affiliateForCustomer(tx, storeId, me.id))
  return row?.status === 'approved' ? row : null
}

/** A CSV download that no cache keeps. */
export function csvResponse(body: string, filename: string): NextResponse {
  return new NextResponse(body, {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${filename}"`,
      'cache-control': 'private, no-store',
    },
  })
}

export const notFoundResponse = () => new NextResponse('Not found', { status: 404 })
