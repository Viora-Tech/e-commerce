import { honoIslandFile, islandFileType } from '@/lib/hono-island/route'
import { honoEnv } from '@/lib/hono-island/state'

type Params = { params: Promise<{ file: string }> }

/**
 * The buy box island's script and stylesheet (`apps/storefront-hono/src/island`), served from the Hono service
 * on the store's own origin so the page's CSP and cookies stay the same. File names carry a
 * content hash, so a found file is cached for a year.
 */
export async function GET(_request: Request, { params }: Params): Promise<Response> {
  const file = honoIslandFile((await params).file)
  const { url } = honoEnv()
  if (!file || !url) return new Response('Not found', { status: 404 })
  try {
    const res = await fetch(`${url}/hono-island/${file}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return new Response('Not found', { status: 404 })
    return new Response(await res.arrayBuffer(), {
      headers: {
        'content-type': islandFileType(file),
        'cache-control': 'public, max-age=31536000, immutable',
        'x-content-type-options': 'nosniff',
      },
    })
  } catch {
    return new Response('Bad gateway', { status: 502 })
  }
}
