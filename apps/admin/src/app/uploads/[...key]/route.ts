import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { assertSafeKey, localStoragePath } from '@commerce/core'
import { isAllowedContentType } from '@commerce/storage'

type Params = { params: Promise<{ key: string[] }> }

const notFound = () => new Response('Not found', { status: 404 })

/**
 * `svg` maps to a content type on purpose, even though `image/svg+xml` is no
 * longer in the upload allow-list (see `packages/storage/src/keys.ts`): a
 * store created before that change may still have `.svg` keys in the
 * bucket, and they need to keep loading, just never inline (see below).
 */
const EXTENSION_CONTENT_TYPE: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
  svg: 'image/svg+xml',
  mp4: 'video/mp4',
}

function contentTypeFor(key: string): string | null {
  const ext = key.split('.').pop()?.toLowerCase()
  const type = ext ? EXTENSION_CONTENT_TYPE[ext] : undefined
  if (!type) return null
  // svg is deliberately not in isAllowedContentType any more, but a legacy
  // upload with that extension must still resolve to a type so it can be
  // served (as a download, never inline — see the Content-Disposition below).
  return type === 'image/svg+xml' || isAllowedContentType(type) ? type : null
}

/**
 * Reads for the local storage provider's built-in default: `LocalStorageProvider.publicUrl`
 * points here. Keys are unguessable (a random id, never a sequence) so no session is
 * required, same as an object store's public URL. Refuses anything that is not one of
 * the media library's allowed types, and any key that tries to climb out of the folder.
 *
 * Every response carries `X-Content-Type-Options: nosniff` and a locked-down
 * `Content-Security-Policy` (`default-src 'none'; sandbox`) so a served file
 * — even one that slips past the allow-list — can never execute as a page in
 * its own right. A legacy `.svg` (no longer accepted on upload, still may
 * exist from before this fix) is additionally forced to download rather than
 * render inline, which is what would let an SVG's `<script>` run.
 */
export async function GET(_req: Request, { params }: Params) {
  const { key: segments } = await params
  const key = segments.join('/')
  const contentType = contentTypeFor(key)
  if (!contentType) return notFound()

  let path: string
  try {
    path = localStoragePath(key)
    assertSafeKey(key)
  } catch {
    return notFound()
  }

  let size: number
  try {
    size = (await stat(path)).size
  } catch {
    return notFound()
  }

  const isLegacySvg = contentType === 'image/svg+xml'
  const body = Readable.toWeb(createReadStream(path)) as ReadableStream
  return new Response(body, {
    headers: {
      'content-type': contentType,
      'content-length': String(size),
      // Keys embed a fresh id per upload; the same key is never overwritten, so this is safe to cache forever.
      'cache-control': 'public, max-age=31536000, immutable',
      'x-content-type-options': 'nosniff',
      'content-security-policy': "default-src 'none'; sandbox",
      ...(isLegacySvg ? { 'content-disposition': 'attachment' } : {}),
    },
  })
}
