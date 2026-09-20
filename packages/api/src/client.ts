import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'
import type { RouterClient } from '@orpc/server'
import type { AppRouter } from './routers/_app'

export type ApiClient = RouterClient<AppRouter>

export function createApiClient(url: string, headers?: () => Record<string, string>): ApiClient {
  const link = new RPCLink({ url, headers: headers ?? (() => ({})) })
  return createORPCClient(link)
}
