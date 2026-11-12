import { os } from '@orpc/server'
import { RPCHandler } from '@orpc/server/fetch'
import { BatchHandlerPlugin } from '@orpc/server/plugins'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApiClient } from '../src/client'
import { createRequestMemo, type RequestMemo, remember } from '../src/procedures/request-memo'

// A stand-in router with the same shape the admin uses: reads that look up the session through
// the request memo, a call that fails, and the streaming assistant path.
let lookups = 0
const base = os.$context<{ memo?: RequestMemo }>()
const whoAmI = ({ context }: { context: { memo?: RequestMemo } }) =>
  remember(context.memo, 'session', async () => {
    lookups++
    return 'member-1'
  })
const router = {
  orders: { list: base.handler(async (o) => `orders for ${await whoAmI(o)}`) },
  customers: { list: base.handler(async (o) => `customers for ${await whoAmI(o)}`) },
  broken: base.handler(() => {
    throw new Error('nope')
  }),
  ai: {
    assistant: base.handler(async function* () {
      yield 'a'
      yield 'b'
    }),
  },
}
const handler = new RPCHandler(router, { plugins: [new BatchHandlerPlugin()] })

let requests: string[] = []
const realFetch = globalThis.fetch

function serve() {
  requests = []
  lookups = 0
  globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(input, init)
    requests.push(new URL(request.url).pathname)
    const { response } = await handler.handle(request, {
      prefix: '/api/rpc',
      context: { memo: createRequestMemo() },
    })
    return response ?? new Response('Not found', { status: 404 })
  }) as typeof fetch
}

afterEach(() => {
  globalThis.fetch = realFetch
})

// biome-ignore lint/suspicious/noExplicitAny: the stand-in router is not AppRouter
const client = (batch: boolean) =>
  createApiClient('http://admin.test/api/rpc', undefined, [], { batch }) as any

describe('createApiClient batching', () => {
  it('sends calls made together as one request that shares one session lookup', async () => {
    serve()
    const api = client(true)
    const [orders, customers] = await Promise.all([api.orders.list(), api.customers.list()])
    expect(orders).toBe('orders for member-1')
    expect(customers).toBe('customers for member-1')
    expect(requests).toEqual(['/api/rpc/__batch__'])
    expect(lookups).toBe(1)
  })

  it('keeps each call its own error inside a batch', async () => {
    serve()
    const api = client(true)
    const [ok, failed] = await Promise.allSettled([api.orders.list(), api.broken()])
    expect(ok).toEqual({ status: 'fulfilled', value: 'orders for member-1' })
    expect(failed.status).toBe('rejected')
    expect(requests).toEqual(['/api/rpc/__batch__'])
  })

  it('never batches the streaming assistant', async () => {
    serve()
    const api = client(true)
    const [stream] = await Promise.all([api.ai.assistant(), api.orders.list()])
    const parts: string[] = []
    for await (const part of stream) parts.push(part)
    expect(parts).toEqual(['a', 'b'])
    expect(requests).toContain('/api/rpc/ai/assistant')
  })

  it('without batch, each call is its own request with its own lookup', async () => {
    serve()
    const api = client(false)
    await Promise.all([api.orders.list(), api.customers.list()])
    expect(requests.sort()).toEqual(['/api/rpc/customers/list', '/api/rpc/orders/list'])
    expect(lookups).toBe(2)
  })
})
