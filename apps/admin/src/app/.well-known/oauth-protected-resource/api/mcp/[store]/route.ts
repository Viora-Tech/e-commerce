import { OAUTH_CORS, protectedResourceMetadata } from '@commerce/api'
import { mcpHost } from '@/lib/mcp-host'

type Context = { params: Promise<{ store: string }> }

/** RFC 9728: which authorization server signs clients in for this store's MCP address. */
export async function GET(_request: Request, { params }: Context) {
  const { store } = await params
  return Response.json(protectedResourceMetadata(mcpHost().origin, store), { headers: OAUTH_CORS })
}
