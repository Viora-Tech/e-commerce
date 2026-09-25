import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { Readable } from 'node:stream'
import { assertSafeKey, localStoragePath } from '@commerce/core'
import { isAllowedContentType } from '@commerce/storage'

type Params = { params: Promise<{ key: string[] }> }

const notFound = () => new Response('Not found', { status: 404 })

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
  return type && isAllowedContentType(type) ? type : null
}

/**
 * Reads for the local storage provider's built-in default: `LocalStorageProvider.publicUrl`
 * points here. Keys are unguessable (a random id, never a sequence) so no session is
 * required, same as an object store's public URL. Refuses anything that is not one of
 * the media library's allowed types, and any key that tries to climb out of the folder.
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

  const body = Readable.toWeb(createReadStream(path)) as ReadableStream
  return new Response(body, {
    headers: {
      'content-type': contentType,
      'content-length': String(size),
      // Keys embed a fresh id per upload; the same key is never overwritten, so this is safe to cache forever.
      'cache-control': 'public, max-age=31536000, immutable',
    },
  })
}
