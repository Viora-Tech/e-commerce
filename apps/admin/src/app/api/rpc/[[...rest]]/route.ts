import { appRouter } from '@commerce/api'
import { RPCHandler } from '@orpc/server/fetch'
import { apiHost } from '@/lib/api'

const handler = new RPCHandler(appRouter)

async function handle(request: Request) {
  const { response } = await handler.handle(request, {
    prefix: '/api/rpc',
    context: { ...apiHost(), headers: request.headers },
  })
  return response ?? new Response('Not found', { status: 404 })
}

export const GET = handle
export const POST = handle
