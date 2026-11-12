import { createORPCClient } from '@orpc/client'
import { RPCLink } from '@orpc/client/fetch'
import { BatchLinkPlugin } from '@orpc/client/plugins'
import type { RouterClient } from '@orpc/server'
import type { AppRouter } from './routers/_app'

export type ApiClient = RouterClient<AppRouter>

/** Runs around every call the client makes, e.g. to reword the errors it throws. */
export type ApiClientInterceptor = NonNullable<
  ConstructorParameters<typeof RPCLink>[0]['interceptors']
>[number]

/**
 * Procedures that answer with a stream (an async iterator). The batch protocol answers each call
 * once, so these always go as their own request.
 */
const STREAMING_PATHS = new Set(['ai.assistant'])

export type ApiClientOptions = {
  /**
   * Send calls made in the same tick as one HTTP request (`/__batch__`). The host must run
   * `BatchHandlerPlugin`; each call keeps its own result and error. The admin's RPC route
   * shares one session and membership lookup across a batch, so a page's reads pay it once.
   */
  batch?: boolean
}

export function createApiClient(
  url: string,
  headers?: () => Record<string, string>,
  interceptors: ApiClientInterceptor[] = [],
  options: ApiClientOptions = {},
): ApiClient {
  const plugins = options.batch
    ? [
        new BatchLinkPlugin({
          groups: [{ condition: () => true, context: {} }],
          url: `${url}/__batch__`,
          exclude: ({ path }) => STREAMING_PATHS.has(path.join('.')),
        }),
      ]
    : []
  const link = new RPCLink({ url, headers: headers ?? (() => ({})), interceptors, plugins })
  return createORPCClient(link)
}
