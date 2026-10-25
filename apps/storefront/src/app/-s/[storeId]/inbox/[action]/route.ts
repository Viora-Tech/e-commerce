import { shopperPoll, shopperStream } from '@/lib/inbox'
import { uploadChatPhoto } from '@/lib/inbox-photo'
import { clientIp, rateLimited } from '@/lib/rate-limit'
import { requestStoreId } from '@/lib/request-store'

// Per shopper and per request: never cached or prerendered.
export const dynamic = 'force-dynamic'

type Params = { params: Promise<{ storeId: string; action: string }> }

/** A poll every 4 s is 15 a minute; this leaves room for a few tabs, not a flood. */
const POLL_RULE = { limit: 60, windowMs: 60_000 }

const NO_STORE = { 'Cache-Control': 'private, no-store' }

/**
 * The Inbox widget's read endpoints: `/inbox/stream` (Server-Sent Events, the shopper's own
 * conversation only) and `/inbox/poll?after=<message id>` (the fallback when the stream does
 * not get through). The store is the one the hostname resolved to, never the path or a
 * parameter; the shopper is their chat cookie or session (design 2026-10-24-inbox §4).
 */
export async function GET(request: Request, { params }: Params) {
  const { action } = await params
  const storeId = await requestStoreId()
  if (action === 'stream') return shopperStream(storeId, request)
  if (action === 'poll') {
    const limit = await rateLimited(
      'inbox-poll:ip',
      `${storeId}:${clientIp(request.headers)}`,
      POLL_RULE,
    )
    if (!limit.ok)
      return Response.json({ events: [], unread: 0 }, { status: 429, headers: NO_STORE })
    const after = new URL(request.url).searchParams.get('after')
    return Response.json(await shopperPoll(storeId, after), { headers: NO_STORE })
  }
  return new Response('Not found', { status: 404 })
}

/** `/inbox/photo`: one chat photo, answered with a signed token the message then carries. */
export async function POST(request: Request, { params }: Params) {
  const { action } = await params
  if (action !== 'photo') return new Response('Not found', { status: 404 })
  const result = await uploadChatPhoto(request)
  return Response.json(result, { status: result.ok ? 200 : 422, headers: NO_STORE })
}
