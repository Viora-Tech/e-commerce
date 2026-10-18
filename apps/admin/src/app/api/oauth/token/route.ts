import { handleToken, OAUTH_CORS } from '@commerce/api'
import { mcpHost } from '@/lib/mcp-host'

/** OAuth token endpoint: authorization_code (PKCE) and refresh_token. */
export const POST = (request: Request) => handleToken(request, mcpHost())
export const OPTIONS = () => new Response(null, { status: 204, headers: OAUTH_CORS })
