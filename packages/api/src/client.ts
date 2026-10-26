import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'
import type { RouterClient } from '@orpc/server'
import type { AppRouter } from './routers/_app'

export type ApiClient = RouterClient<AppRouter>

/** Runs around every call the client makes, e.g. to reword the errors it throws. */
export type ApiClientInterceptor = NonNullable<
  ConstructorParameters<typeof RPCLink>[0]['interceptors']
>[number]

export function createApiClient(
  url: string,
  headers?: () => Record<string, string>,
  interceptors: ApiClientInterceptor[] = [],
): ApiClient {
  const link = new RPCLink({ url, headers: headers ?? (() => ({})), interceptors })
  return createORPCClient(link)
}
