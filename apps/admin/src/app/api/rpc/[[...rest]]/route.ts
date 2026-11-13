import { appRouter, createRequestMemo } from '@commerce/api'
import { RPCHandler } from '@orpc/server/fetch'
import { BatchHandlerPlugin } from '@orpc/server/plugins'
import { apiHost, platformHost } from '@/lib/api'
import { isCrossOriginBrowserRequest } from '@/lib/request-site'

// The admin's browser client batches calls made together (`/api/rpc/__batch__`, at most 10).
const handler = new RPCHandler(appRouter, { plugins: [new BatchHandlerPlugin()] })

async function handle(request: Request) {
  // Only the admin's own pages call this API; a form posted from a storefront on the same
  // site would otherwise carry the merchant's session cookie (`lib/request-site.ts`).
  if (isCrossOriginBrowserRequest(request.headers)) {
    return new Response('Forbidden', { status: 403 })
  }
  const { response } = await handler.handle(request, {
    prefix: '/api/rpc',
    // One memo per HTTP request: every call in a batch shares one session and membership lookup.
    context: {
      ...apiHost(),
      ...platformHost(),
      headers: request.headers,
      memo: createRequestMemo(),
    },
  })
  return response ?? new Response('Not found', { status: 404 })
}

export const GET = handle
export const POST = handle
