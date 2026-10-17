import { handleRevoke, OAUTH_CORS } from '@commerce/api'
import { mcpHost } from '@/lib/mcp-host'

/** OAuth token revocation (RFC 7009): a client signing itself out. */
export const POST = (request: Request) => handleRevoke(request, mcpHost())
export const OPTIONS = () => new Response(null, { status: 204, headers: OAUTH_CORS })
