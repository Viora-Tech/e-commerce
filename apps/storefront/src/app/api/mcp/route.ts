import { agentStoreName } from '@commerce/core'
import {
  answerAgentRpc,
  type RpcMessage,
  RpcMessageSchema,
  type RpcReply,
  rpcInvalid,
  rpcParseError,
} from '@/lib/agent-mcp'
import { clientIp, rateLimited, retryAfterSeconds } from '@/lib/rate-limit'
import { withEvlog } from '@/lib/request-log'
import '@/lib/search-engine'
import { requestOrigin } from '@/lib/seo'
import { inStore } from '@/lib/store-context'
import { storefrontLock } from '@/lib/storefront-gate'

/** An agent searching on a shopper's behalf calls a few times a turn; scripts get slowed down. */
const AGENT_IP_RULE = { limit: 60, windowMs: 60_000 }
const MAX_BATCH = 10

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-methods': 'POST, OPTIONS',
  'access-control-allow-headers': 'content-type, mcp-protocol-version, mcp-session-id',
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
      ...CORS,
      ...headers,
    },
  })

/**
 * The store's MCP endpoint for AI shopping agents (`lib/agent-mcp.ts`): read-only, no sign-in.
 * Off when the store is locked or Online store → Preferences turns AI crawlers off.
 */
export const POST = withEvlog(async (request: Request) => {
  const storeId = request.headers.get('x-store-id')
  if (!storeId) return new Response(null, { status: 404 })
  const lock = await storefrontLock(storeId)
  if (lock.enabled || !lock.ai) return json({ error: 'not_found' }, 404)
  const limit = await rateLimited('agent-mcp:ip', clientIp(request.headers), AGENT_IP_RULE)
  if (!limit.ok)
    return json({ error: 'rate_limited' }, 429, { 'retry-after': String(retryAfterSeconds(limit)) })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json(rpcParseError(), 400)
  }
  const batch = Array.isArray(body)
  const messages = (batch ? body : [body]) as unknown[]
  if (!messages.length || messages.length > MAX_BATCH) return json(rpcInvalid(), 400)

  const origin = await requestOrigin()
  const env = {
    storeName: await inStore(storeId, (tx) => agentStoreName(tx, storeId)),
    origin,
    inStore: <T>(fn: Parameters<typeof inStore<T>>[1]) => inStore(storeId, fn),
  }
  const replies: RpcReply[] = []
  for (const raw of messages) {
    const parsed = RpcMessageSchema.safeParse(raw)
    if (!parsed.success) {
      replies.push(rpcInvalid())
      continue
    }
    const reply = await answerAgentRpc(env, parsed.data as RpcMessage)
    if (reply) replies.push(reply)
  }
  // Only notifications: accepted, nothing to answer.
  if (!replies.length) return new Response(null, { status: 202, headers: CORS })
  return json(batch ? replies : replies[0])
})

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS })
}

/** No server-to-client stream: every answer comes back on its POST. */
export function GET() {
  return new Response(null, { status: 405, headers: { allow: 'POST, OPTIONS', ...CORS } })
}
