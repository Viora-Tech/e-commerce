import { handleMcpRequest, OAUTH_CORS } from '@commerce/api'
import { mcpHost } from '@/lib/mcp-host'

type Context = { params: Promise<{ store: string }> }

/** Settings → MCP & API: the store's MCP server (bearer auth, never cookies, so CORS is open). */
async function handle(request: Request, { params }: Context) {
  const { store } = await params
  const response = await handleMcpRequest(request, store, mcpHost())
  for (const [k, v] of Object.entries(OAUTH_CORS)) response.headers.set(k, v)
  return response
}

export const GET = handle
export const POST = handle
export const DELETE = handle
export const OPTIONS = () => new Response(null, { status: 204, headers: OAUTH_CORS })
