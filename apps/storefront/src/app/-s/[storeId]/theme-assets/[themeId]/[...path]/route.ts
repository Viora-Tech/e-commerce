import { themeAssetFile } from '@commerce/core'
import { inStore } from '@/lib/store-context'

type Params = { params: Promise<{ storeId: string; themeId: string; path: string[] }> }

const notFound = () => new Response('Not found', { status: 404 })

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * The `assets/` files of an imported Shopify theme (CSS, JS, fonts, icons), what
 * `asset_url` points at. Store-scoped by RLS like every storefront read. URLs carry
 * the file's checksum (`?v=`), so a matching request is cached for a year; fonts
 * answer any origin because the Customize canvas (the admin) loads them too.
 */
export async function GET(req: Request, { params }: Params) {
  const { storeId, themeId, path } = await params
  if (!UUID.test(themeId)) return notFound()
  const file = path.map((p) => decodeURIComponent(p)).join('/')
  if (!file || file.includes('..') || file.includes('\0')) return notFound()
  const asset = await inStore(storeId, (tx) => themeAssetFile(tx, themeId, file))
  if (!asset) return notFound()
  const versioned = new URL(req.url).searchParams.get('v') === asset.checksum
  const headers: Record<string, string> = {
    'content-type': asset.contentType.startsWith('text/') ? `${asset.contentType}; charset=utf-8` : asset.contentType,
    'cache-control': versioned ? 'public, max-age=31536000, immutable' : 'public, max-age=300',
    'x-content-type-options': 'nosniff',
    'access-control-allow-origin': '*',
    etag: `"${asset.checksum}"`,
  }
  // An SVG opened on its own never runs script.
  if (asset.contentType === 'image/svg+xml') {
    headers['content-security-policy'] = "default-src 'none'; style-src 'unsafe-inline'; sandbox"
  }
  return new Response(asset.body as unknown as BodyInit, { headers })
}
