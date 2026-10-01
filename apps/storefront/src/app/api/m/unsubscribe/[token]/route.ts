import { settingsSecret } from '@commerce/config'
import { unsubscribeCustomer, verifyUnsubscribeToken } from '@commerce/core'
import { headers } from 'next/headers'
import { inStore } from '@/lib/store-context'

type Params = { params: Promise<{ token: string }> }

/**
 * One-click unsubscribe (RFC 8058): mail clients POST here from the
 * List-Unsubscribe header. POST only, so link scanners cannot unsubscribe
 * anyone by fetching it.
 */
export async function POST(_request: Request, { params }: Params) {
  const { token } = await params
  const storeId = (await headers()).get('x-store-id')
  const v = verifyUnsubscribeToken(token, settingsSecret())
  if (!v || !storeId || v.storeId !== storeId) return new Response(null, { status: 404 })
  await inStore(storeId, (tx) => unsubscribeCustomer(tx, v.customerId))
  return new Response(null, { status: 200 })
}
