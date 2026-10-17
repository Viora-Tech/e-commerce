import { appRouter, clientIp } from '@commerce/api'
import {
  API_RATE_LIMIT,
  authenticateApiToken,
  checkRateLimit,
  rateLimitKey,
  retryAfterSeconds,
} from '@commerce/core'
import { RPCHandler } from '@orpc/server/fetch'
import { apiHost } from '@/lib/api'
import { mcpHost } from '@/lib/mcp-host'

const handler = new RPCHandler(appRouter)

const refuse = (status: number, message: string, headers: Record<string, string> = {}) =>
  Response.json({ error: message }, { status, headers })

/**
 * The store API for scripts (Settings → MCP & API → Access tokens): the admin's own procedures
 * over oRPC, `POST /api/v1/<router>/<procedure>` with `Authorization: Bearer kmc_live_…`. Each
 * call runs as the token's member, capped to the token's areas; cookies are never read here.
 */
async function handle(request: Request) {
  const token = request.headers.get('authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1]
  if (!token) return refuse(401, 'Send an access token: Authorization: Bearer kmc_live_…')
  const host = mcpHost()
  const auth = await authenticateApiToken(host.db, token, { ip: clientIp(request) })
  if (!auth.ok)
    return refuse(
      401,
      auth.reason === 'expired' ? 'This access token expired' : 'Unknown access token',
    )
  const limit = await checkRateLimit(
    host.rateLimit,
    rateLimitKey('api', auth.principal.grantId),
    API_RATE_LIMIT,
  )
  if (!limit.ok)
    return refuse(429, 'Too many requests for this token', {
      'retry-after': String(retryAfterSeconds(limit)),
    })
  // No cookie ever reaches the router from here: a token is the only identity.
  const headers = new Headers(request.headers)
  headers.delete('cookie')
  const { response } = await handler.handle(request, {
    prefix: '/api/v1',
    context: { ...apiHost(), headers, apiPrincipal: auth.principal },
  })
  return response ?? refuse(404, 'Not found')
}

export const POST = handle
export const GET = handle
