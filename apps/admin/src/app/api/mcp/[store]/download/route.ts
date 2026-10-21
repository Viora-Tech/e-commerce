import { handleMcpDownload } from '@commerce/api'
import { mcpHost } from '@/lib/mcp-host'

type Context = { params: Promise<{ store: string }> }

/**
 * A file an MCP client asked for (label, invoice, export): the signed, ten-minute link
 * `runAction` answered with. The link carries the grant, never a cookie or a token.
 */
export async function GET(request: Request, { params }: Context) {
  const { store } = await params
  return handleMcpDownload(request, store, mcpHost())
}
