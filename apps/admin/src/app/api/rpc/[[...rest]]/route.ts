import { appRouter } from '@commerce/api'
import { RPCHandler } from '@orpc/server/fetch'
import { apiHost, platformHost } from '@/lib/api'
import { isCrossOriginBrowserRequest } from '@/lib/request-site'

const handler = new RPCHandler(appRouter)

async function handle(request: Request) {
  // Only the admin's own pages call this API; a form posted from a storefront on the same
  // site would otherwise carry the merchant's session cookie (`lib/request-site.ts`).
  if (isCrossOriginBrowserRequest(request.headers)) {
    return new Response('Forbidden', { status: 403 })
  }
  const { response } = await handler.handle(request, {
    prefix: '/api/rpc',
    context: { ...apiHost(), ...platformHost(), headers: request.headers },
  })
  return response ?? new Response('Not found', { status: 404 })
}

export const GET = handle
export const POST = handle
