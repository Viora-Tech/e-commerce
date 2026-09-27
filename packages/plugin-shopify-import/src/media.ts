/**
 * Re-host source images in the store's own storage provider. Each source URL
 * is downloaded once per store: the import mapping (resource `media`, keyed by
 * the URL without its `?v=` query) points at our media row thereafter.
 */
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

const EXT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
  svg: 'image/svg+xml',
  mp4: 'video/mp4',
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

function contentTypeOf(header: string | null, url: string): string {
  const fromHeader = header?.split(';')[0]?.trim().toLowerCase()
  if (fromHeader && isAllowedContentType(fromHeader)) return fromHeader
  const ext = url.split('.').pop()?.toLowerCase() ?? ''
  return EXT_TYPES[ext] ?? fromHeader ?? 'application/octet-stream'
}

export type MediaHostOptions = {
  storeId: string
  inStore: InStore
  storage: () => Promise<StorageProvider>
  fetch?: typeof fetch
  timeoutMs?: number
  /**
   * Called after an image row is written, so the caller can queue it for the
   * upload-time pipeline (see `@commerce/core/media-pipeline`) the same way
   * `mediaRouter.confirm` does for a direct upload. Optional: an import run
   * without this wired up leaves the row `processing` for `bun run
   * media:reprocess` to pick up later, same as any other stuck row.
   */
  onMediaImported?: (mediaId: string, contentType: string) => Promise<void>
}

export function createMediaHost(opts: MediaHostOptions): MediaHost {
  const doFetch = opts.fetch ?? fetch
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

      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 30_000)
      let bytes: Uint8Array
      let contentType: string
      try {
        const res = await doFetch(key, { signal: controller.signal })
        if (!res.ok) throw new Error(`download failed (${res.status})`)
        contentType = contentTypeOf(res.headers.get('content-type'), key)
        if (!isAllowedContentType(contentType)) throw new Error(`${contentType} is not supported`)
        const limit = maxUploadBytesFor(contentType)
        const limitMb = Math.round(limit / 1024 / 1024)
        const declared = Number(res.headers.get('content-length') ?? 0)
        if (declared > limit) throw new Error(`file is larger than ${limitMb} MB`)
        bytes = new Uint8Array(await res.arrayBuffer())
        if (bytes.byteLength > limit) throw new Error(`file is larger than ${limitMb} MB`)
      } finally {
        clearTimeout(timer)
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
      if (needsPipeline) await opts.onMediaImported?.(id, contentType)
      known.set(key, id)
      return id
    },
  }
}
