/**
 * Re-host source images in the store's own storage provider. Each source URL
 * is downloaded once per store: the import mapping (resource `media`, keyed by
 * the URL without its `?v=` query) points at our media row thereafter.
 */
import { type LookupAll, readCapped, safeFetch } from '@commerce/core/safe-fetch'
import { media, newId } from '@commerce/db'
import {
  isAllowedContentType,
  isImageContentType,
  maxUploadBytesFor,
  mediaKey,
  type StorageProvider,
} from '@commerce/storage'
import { eq } from 'drizzle-orm'
import { createLimiter } from './concurrency'
import { findMapping, type InStore, type MediaHost, saveMapping } from './runtime'

/**
 * Downloads in flight across one import (every product's images and the Files
 * step share it). Streamed copies hold one chunk each; buffered ones up to the
 * image cap, so this bounds memory well inside the worker's limit.
 */
const MEDIA_IN_FLIGHT = 16
/**
 * Copies that have to be held whole (no stream support, unknown type or size,
 * so possibly a 100 MB video) get their own, much smaller cap.
 */
const BUFFERED_LARGE_IN_FLIGHT = 2

/** Count the bytes as they pass; a body longer or shorter than it said is an error. */
function exactly(size: number): TransformStream<Uint8Array, Uint8Array> {
  let seen = 0
  return new TransformStream({
    transform(chunk, controller) {
      seen += chunk.byteLength
      if (seen > size) controller.error(new Error('the download was longer than it said'))
      else controller.enqueue(chunk)
    },
    flush(controller) {
      if (seen !== size) controller.error(new Error('the download ended early'))
    },
  })
}

/** `//cdn.shopify.com/a.jpg?v=12` → `https://cdn.shopify.com/a.jpg`. */
export function mediaSourceKey(src: string): string {
  const absolute = src.startsWith('//') ? `https:${src}` : src
  return absolute.split(/[?#]/)[0] ?? absolute
}

function filenameOf(url: string): string {
  const last = url.split('/').pop() ?? 'image'
  try {
    return decodeURIComponent(last)
  } catch {
    return last
  }
}

const ascii = (bytes: Uint8Array, from: number, to: number) =>
  String.fromCharCode(...bytes.subarray(from, to))

/**
 * What the bytes say they are (magic numbers), for a response whose own
 * content type is not one we accept. The URL's extension is never trusted:
 * `…/latest/meta-data.mp4` redirected somewhere internal would otherwise be
 * stored as video. ISO BMFF (`ftyp`) covers AVIF, HEIC, MP4 and QuickTime.
 */
function sniffContentType(bytes: Uint8Array): string | null {
  const [b0, b1, b2, b3] = bytes
  if (b0 === 0xff && b1 === 0xd8 && b2 === 0xff) return 'image/jpeg'
  if (b0 === 0x89 && ascii(bytes, 1, 4) === 'PNG') return 'image/png'
  if (ascii(bytes, 0, 4) === 'GIF8') return 'image/gif'
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP') return 'image/webp'
  if (b0 === 0x1a && b1 === 0x45 && b2 === 0xdf && b3 === 0xa3) return 'video/webm'
  if (ascii(bytes, 4, 8) === 'ftyp') {
    const brand = ascii(bytes, 8, 12)
    if (brand === 'avif' || brand === 'avis') return 'image/avif'
    if (['heic', 'heix', 'hevc', 'heim', 'heis', 'mif1', 'msf1'].includes(brand))
      return 'image/heic'
    if (brand === 'qt  ') return 'video/quicktime'
    return 'video/mp4'
  }
  return null
}

export type MediaHostOptions = {
  storeId: string
  inStore: InStore
  storage: () => Promise<StorageProvider>
  fetch?: typeof fetch
  /** DNS for the SSRF check (`@commerce/core/safe-fetch`); tests inject a fake. */
  lookup?: LookupAll
  timeoutMs?: number
  /**
   * Called once per newly hosted image, after its row is written, so the
   * caller can queue it for the upload-time pipeline (see
   * `@commerce/core/media-pipeline`) the same way `mediaRouter.confirm` does
   * for a direct upload. Never called for a source already mapped (a re-run,
   * or the same image on two products) or for video, which is stored `ready`.
   * Runs inside `host`, so it shares the caller's download concurrency. An
   * import run without this wired up leaves the row `processing` for `bun run
   * media:reprocess` to pick up later, same as any other stuck row.
   */
  onMediaImported?: (mediaId: string, contentType: string, src: string) => Promise<void>
  /** Overrides `MEDIA_IN_FLIGHT` (tests). */
  maxInFlight?: number | undefined
}

export function createMediaHost(opts: MediaHostOptions): MediaHost {
  const known = new Map<string, string>()
  let provider: StorageProvider | null = null
  const inFlight = createLimiter(opts.maxInFlight ?? MEDIA_IN_FLIGHT)
  const largeBuffered = createLimiter(BUFFERED_LARGE_IN_FLIGHT)

  return {
    async urlOf(mediaId) {
      const [row] = await opts.inStore((tx) =>
        tx.select({ url: media.url }).from(media).where(eq(media.id, mediaId)),
      )
      return row?.url ?? null
    },

    async host(src, alt) {
      const key = mediaSourceKey(src)
      const cached = known.get(key)
      if (cached) return cached
      const existing = await opts.inStore(async (tx) => {
        const id = await findMapping(tx, 'media', key)
        if (!id) return null
        const [row] = await tx.select({ id: media.id }).from(media).where(eq(media.id, id))
        if (row && alt) await tx.update(media).set({ alt }).where(eq(media.id, id))
        return row?.id ?? null
      })
      if (existing) {
        known.set(key, existing)
        return existing
      }

      return inFlight(() => copy(key, alt))
    },
  }

  /** Download one source and store it: streamed when the bucket can take a stream. */
  async function copy(key: string, alt: string | null): Promise<string> {
    // Source URLs come from a CSV or product HTML: only public hosts, every
    // redirect re-checked, bytes capped while streaming. Merchant CSVs may
    // still carry http:// image links, so http is allowed (address checks hold).
    const res = await safeFetch(key, {
      allowHttp: true,
      timeoutMs: opts.timeoutMs ?? 30_000,
      ...(opts.fetch ? { fetch: opts.fetch } : {}),
      ...(opts.lookup ? { lookup: opts.lookup } : {}),
    })
    if (!res.ok) {
      await res.body?.cancel()
      throw new Error(`download failed (${res.status})`)
    }
    const declaredType = res.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase()
    const trusted = declaredType && isAllowedContentType(declaredType) ? declaredType : null
    const declaredSize = Number(res.headers.get('content-length') ?? Number.NaN)
    provider ??= await opts.storage()
    const store = provider
    const id = newId()
    const keyFor = (contentType: string) =>
      mediaKey({ storeId: opts.storeId, filename: filenameOf(key), contentType, id })

    let contentType: string
    let size: number
    let objectKey: string
    if (
      trusted &&
      store.putStream &&
      res.body &&
      Number.isFinite(declaredSize) &&
      declaredSize > 0
    ) {
      // Known type and size: straight from the download into the bucket, never held whole.
      const limit = maxUploadBytesFor(trusted)
      if (declaredSize > limit) {
        await res.body.cancel()
        throw new Error(`file is larger than ${Math.round(limit / 1024 / 1024)} MB`)
      }
      contentType = trusted
      size = declaredSize
      objectKey = keyFor(contentType)
      await store.putStream({
        key: objectKey,
        body: res.body.pipeThrough(exactly(declaredSize)),
        contentType,
        size,
      })
    } else {
      // Unknown type: read up to the largest cap any accepted type has, then sniff.
      const readLimit = maxUploadBytesFor(trusted ?? 'video/mp4')
      const read = () => readCapped(res, readLimit)
      const bytes = isImageContentType(trusted ?? '') ? await read() : await largeBuffered(read)
      if (!bytes) throw new Error(`file is larger than ${Math.round(readLimit / 1024 / 1024)} MB`)
      contentType = trusted ?? sniffContentType(bytes) ?? declaredType ?? 'application/octet-stream'
      if (!isAllowedContentType(contentType)) throw new Error(`${contentType} is not supported`)
      const limit = maxUploadBytesFor(contentType)
      if (bytes.byteLength > limit) {
        throw new Error(`file is larger than ${Math.round(limit / 1024 / 1024)} MB`)
      }
      size = bytes.byteLength
      objectKey = keyFor(contentType)
      await store.put({ key: objectKey, body: bytes, contentType })
    }
    // Imported images still go through the pipeline (strip EXIF/GPS, generate
    // AVIF/WebP variants) — Shopify's own CDN copy is not something this
    // platform controls, so it gets the same treatment as a direct upload.
    const needsPipeline = isImageContentType(contentType)
    await opts.inStore(async (tx) => {
      await tx.insert(media).values({
        id,
        storeId: opts.storeId,
        url: store.publicUrl(objectKey),
        key: objectKey,
        provider: store.id,
        contentType,
        size,
        alt: alt || null,
        status: needsPipeline ? 'processing' : 'ready',
      })
      await saveMapping(tx, opts.storeId, 'media', key, id)
    })
    if (needsPipeline) await opts.onMediaImported?.(id, contentType, key)
    known.set(key, id)
    return id
  }
}
