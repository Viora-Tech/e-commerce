import { confirmSignup } from '@commerce/plugin-back-in-stock'
import { headers } from 'next/headers'
import { inStore } from '@/lib/store-context'

type Params = { params: Promise<{ token: string }> }

/**
 * Double opt-in confirm link. The token alone identifies the signup (it is
 * random and single-use), so no store id is needed in the URL, only the
 * routing header the proxy already sets for the multi-tenant host.
 */
export async function GET(_request: Request, { params }: Params) {
  const { token } = await params
  const storeId = (await headers()).get('x-store-id')
  if (!storeId) return new Response(null, { status: 404 })
  const row = await inStore(storeId, (tx) => confirmSignup(tx, token))
  if (!row) return new Response('This link has expired or was already used.', { status: 404 })
  return new Response('You are confirmed — we will email you the moment it is back in stock.', {
    status: 200,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  })
}
