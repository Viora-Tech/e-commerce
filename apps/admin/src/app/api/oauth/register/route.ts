import { handleRegister, OAUTH_CORS } from '@commerce/api'
import { mcpHost } from '@/lib/mcp-host'

/** OAuth dynamic client registration (RFC 7591) for MCP clients. */
export const POST = (request: Request) => handleRegister(request, mcpHost())
export const OPTIONS = () => new Response(null, { status: 204, headers: OAUTH_CORS })
