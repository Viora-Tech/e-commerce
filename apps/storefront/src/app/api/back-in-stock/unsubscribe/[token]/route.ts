import { unsubscribeByToken } from '@commerce/plugin-back-in-stock'
import { headers } from 'next/headers'
import { inStore } from '@/lib/store-context'

type Params = { params: Promise<{ token: string }> }

/** The unsubscribe link carried on every back-in-stock message. GET so it also works as a plain email link. */
export async function GET(_request: Request, { params }: Params) {
  const { token } = await params
  const storeId = (await headers()).get('x-store-id')
  if (!storeId) return new Response(null, { status: 404 })
  const row = await inStore(storeId, (tx) => unsubscribeByToken(tx, token))
  if (!row) return new Response(null, { status: 404 })
  return new Response("You won't get any more alerts for this item.", {
    status: 200,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  })
}

export { GET as POST }
