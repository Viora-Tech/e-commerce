import { authorizationServerMetadata, OAUTH_CORS } from '@commerce/api'
import { mcpHost } from '@/lib/mcp-host'

/** RFC 8414: where MCP clients find the sign-in, token and registration endpoints. */
export function GET() {
  return Response.json(authorizationServerMetadata(mcpHost().origin), { headers: OAUTH_CORS })
}
