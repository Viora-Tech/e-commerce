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
import { findMapping, type InStore, type MediaHost, saveMapping } from './runtime'

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
}

export function createMediaHost(opts: MediaHostOptions): MediaHost {
  const known = new Map<string, string>()
  let provider: StorageProvider | null = null

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
      // Unknown type: read up to the largest cap any accepted type has, then sniff.
      const readLimit = maxUploadBytesFor(trusted ?? 'video/mp4')
      const bytes = await readCapped(res, readLimit)
      if (!bytes) throw new Error(`file is larger than ${Math.round(readLimit / 1024 / 1024)} MB`)
      const contentType =
        trusted ?? sniffContentType(bytes) ?? declaredType ?? 'application/octet-stream'
      if (!isAllowedContentType(contentType)) throw new Error(`${contentType} is not supported`)
      const limit = maxUploadBytesFor(contentType)
      if (bytes.byteLength > limit) {
        throw new Error(`file is larger than ${Math.round(limit / 1024 / 1024)} MB`)
      }

      provider ??= await opts.storage()
      const id = newId()
      const objectKey = mediaKey({
        storeId: opts.storeId,
        filename: filenameOf(key),
        contentType,
        id,
      })
      await provider.put({ key: objectKey, body: bytes, contentType })
      const store = provider
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
          size: bytes.byteLength,
          alt: alt || null,
          status: needsPipeline ? 'processing' : 'ready',
        })
        await saveMapping(tx, opts.storeId, 'media', key, id)
      })
      if (needsPipeline) await opts.onMediaImported?.(id, contentType, key)
      known.set(key, id)
      return id
    },
  }
}
