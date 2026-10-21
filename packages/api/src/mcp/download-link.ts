/**
 * Files an MCP client asked for through `runAction` (a courier label, an invoice PDF, an
 * export): the answer is a link, never the bytes. The link is signed (HMAC with the settings
 * secret) and lasts ten minutes; opening it re-runs the same read procedure as the same grant,
 * read fresh, so a revoked client or a narrowed role stops it at once. This is the admin's own
 * download path (the procedure returns a `File`, the route streams it), without a cookie.
 */
import { createHmac, timingSafeEqual } from 'node:crypto'
import { settingsSecret } from '@commerce/config'
import { principalForGrant } from '@commerce/core'
import { call } from '@orpc/server'
import { z } from 'zod'
import { appRouter } from '../routers/_app'
import { areaOf, classifyAction, procedureAt } from './action-catalogue'
import type { McpHost } from './server'

export const DOWNLOAD_TTL_MS = 10 * 60_000
/** A link carries its input; anything longer is not a download. */
const MAX_LINK_INPUT = 2000

const Payload = z.object({
  /** Grant, store, procedure path, input, expiry (epoch ms). */
  g: z.string(),
  s: z.string(),
  p: z.string(),
  i: z.unknown(),
  e: z.number(),
})
type Payload = z.infer<typeof Payload>

const mac = (body: string) =>
  createHmac('sha256', `mcp-download:${settingsSecret()}`).update(body).digest('base64url')

/** The download address for one file read, or null when the input is too long to carry. */
export function downloadUrl(
  origin: string,
  slug: string,
  link: Omit<Payload, 'e'>,
  now: Date,
): string | null {
  const body = Buffer.from(
    JSON.stringify({ ...link, e: now.getTime() + DOWNLOAD_TTL_MS } satisfies Payload),
  ).toString('base64url')
  if (body.length > MAX_LINK_INPUT) return null
  return `${origin}/api/mcp/${slug}/download?t=${body}.${mac(body)}`
}

function verify(token: string, now: Date): Payload | null {
  const [body, sig] = token.split('.')
  if (!body || !sig) return null
  const want = Buffer.from(mac(body))
  const got = Buffer.from(sig)
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null
  try {
    const parsed = Payload.safeParse(JSON.parse(Buffer.from(body, 'base64url').toString('utf8')))
    if (!parsed.success || parsed.data.e <= now.getTime()) return null
    return parsed.data
  } catch {
    return null
  }
}

const refuse = (status: number, message: string) =>
  new Response(message, { status, headers: { 'cache-control': 'no-store' } })

/** `GET /api/mcp/<slug>/download?t=…`: streams the file, as the grant, or refuses. */
export async function handleMcpDownload(
  request: Request,
  slug: string,
  host: McpHost,
): Promise<Response> {
  const now = host.now?.() ?? new Date()
  const link = verify(new URL(request.url).searchParams.get('t') ?? '', now)
  if (!link) return refuse(410, 'This download link expired. Ask for the file again.')
  const principal = await principalForGrant(host.db, link.s, link.g, now)
  if (!principal || principal.storeSlug !== slug.toLowerCase())
    return refuse(403, 'This client no longer has access.')
  const area = areaOf(link.p)
  const procedure = procedureAt(appRouter, link.p)
  if (!procedure || classifyAction(link.p) !== 'read' || !area || !principal.scopes[area])
    return refuse(403, 'This client no longer has access.')
  if (!host.api) return refuse(503, 'Downloads are not available here.')
  try {
    const file = await call(procedure, link.i, {
      context: { ...host.api(), headers: new Headers(), apiPrincipal: principal },
      path: link.p.split('.'),
    })
    if (!(file instanceof Blob)) return refuse(404, 'Not a file.')
    const name = file instanceof File ? file.name : 'download'
    return new Response(file, {
      headers: {
        'content-type': file.type || 'application/octet-stream',
        'content-disposition': `attachment; filename="${name.replace(/["\r\n]/g, '')}"`,
        'cache-control': 'private, no-store',
      },
    })
  } catch {
    return refuse(404, 'Not found')
  }
}
