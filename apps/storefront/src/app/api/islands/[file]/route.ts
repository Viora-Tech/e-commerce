import { ISLAND_MODULES, islandModuleOf, islandModuleVersion } from '@/lib/plain-html/modules'

type Params = { params: Promise<{ file: string }> }

/**
 * A plain HTML page's island module (`lib/plain-html/modules.ts`), the same for every store. The
 * page asks for `?v=<content hash>`: that answer is cached for a year; any other version (an old
 * page after a deploy) gets the current file, cached briefly.
 */
export async function GET(request: Request, { params }: Params): Promise<Response> {
  const name = islandModuleOf((await params).file)
  if (!name) return new Response('Not found', { status: 404 })
  const current = new URL(request.url).searchParams.get('v') === islandModuleVersion(name)
  return new Response(ISLAND_MODULES[name], {
    headers: {
      'content-type': 'text/javascript; charset=utf-8',
      'cache-control': current
        ? 'public, max-age=31536000, immutable'
        : 'public, max-age=60, s-maxage=60',
      'x-content-type-options': 'nosniff',
    },
  })
}
