import { appRouter } from '@commerce/api'
import { RPCHandler } from '@orpc/server/fetch'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'

const handler = new RPCHandler(appRouter)

async function handle(request: Request) {
  const { response } = await handler.handle(request, {
    prefix: '/api/rpc',
    context: { db: db(), auth: auth(), headers: request.headers },
  })
  return response ?? new Response('Not found', { status: 404 })
}

export const GET = handle
export const POST = handle
