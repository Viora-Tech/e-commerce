import { AsyncLocalStorage } from 'node:async_hooks'

/**
 * The request the storefront's modules read through `next/headers` (`./next-headers.ts`): the
 * headers the proxy would forward (store id, path, market, nonce) and the cookies the shopper
 * sent, plus the request memo `React.cache` keeps in Next (`./react-cache.ts`). One per request,
 * set by the server around the page render.
 */
export type RequestContext = { headers: Headers; memo: Map<unknown, Map<string, unknown>> }

export const requestContext = new AsyncLocalStorage<RequestContext>()

export function currentRequest(): RequestContext {
  const ctx = requestContext.getStore()
  if (!ctx) throw new Error('next/headers read outside a request (storefront-hono)')
  return ctx
}
