/** SOURCE OF TRUTH: theme import media — WHAT: the old store's images (`shopify://shop_images`) and videos (`shopify://files/videos`, found on the live home page) downloaded through `safe-fetch` with size caps and copied into storage and Files / WHY: an imported theme must not keep loading its pictures from the store the merchant is leaving; every download is SSRF-checked and capped */
import { media, newId, type StoreTx } from '@commerce/db'
import {
  isAllowedContentType,
  isImageContentType,
  maxUploadBytesFor,
  mediaKey,
} from '@commerce/storage'
import { sql } from 'drizzle-orm'
import sharp from 'sharp'
import { readCapped, safeFetch } from '../net/safe-fetch'
import type { ThemeImportDeps } from './import'
import type { ShopifyJsonTemplate } from './schema'

export const SHOP_IMAGE = /^shopify:\/\/shop_images\/(.+)$/

/** Every `shopify://shop_images/...` string inside a JSON value. */
export function collectShopImages(value: unknown, into: Set<string>): void {
  if (typeof value === 'string') {
    const m = SHOP_IMAGE.exec(value)
    if (m?.[1]) into.add(m[1])
  } else if (Array.isArray(value)) for (const v of value) collectShopImages(v, into)
  else if (value && typeof value === 'object')
    for (const v of Object.values(value)) collectShopImages(v, into)
}

/** Width and height of an image, read by sharp (no decode of the pixels). */
async function sharpSize(bytes: Uint8Array): Promise<{ width: number; height: number } | null> {
  const meta = await sharp(bytes).metadata()
  return meta.width && meta.height ? { width: meta.width, height: meta.height } : null
}

/** Downloads one image (or mp4 video); null when it is larger than we accept. */
async function download(
  src: string,
  deps: ThemeImportDeps,
  kind: 'image' | 'video' = 'image',
): Promise<{ bytes: Uint8Array; contentType: string } | null> {
  const res = await safeFetch(src, {
    timeoutMs: kind === 'video' ? 120_000 : 20_000,
    ...(deps.fetch ? { fetch: deps.fetch } : {}),
    ...(deps.lookup ? { lookup: deps.lookup } : {}),
  })
  if (!res.ok) {
    await res.body?.cancel()
    throw new Error(`download failed (${res.status})`)
  }
  const contentType = res.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() ?? ''
  const wanted = kind === 'image' ? isImageContentType(contentType) : contentType === 'video/mp4'
  if (!isAllowedContentType(contentType) || !wanted) {
    await res.body?.cancel()
    throw new Error(`${contentType || 'unknown type'} is not a file we accept`)
  }
  const bytes = await readCapped(res, maxUploadBytesFor(contentType))
  return bytes ? { bytes, contentType } : null
}

/** Smaller copies we ask Shopify's CDN for, in turn, when the original is over our upload limit. */
const RESIZED_WIDTHS = [3000, 2000, 1400]

/** Copies one image from the merchant's Shopify store into Files. */
export async function copyImage(
  tx: StoreTx,
  storeId: string,
  host: string,
  name: string,
  deps: ThemeImportDeps,
): Promise<{ url: string; width: number | null; height: number | null }> {
  const src = `https://${host}/cdn/shop/files/${name.split('/').map(encodeURIComponent).join('/')}`
  // Shopify's CDN resizes on request; a huge original comes over as a smaller copy.
  let file = await download(src, deps)
  for (const width of RESIZED_WIDTHS) {
    if (file) break
    file = await download(`${src}?width=${width}`, deps)
  }
  if (!file) throw new Error('image is too large')
  return storeFile(tx, storeId, name.split('/').pop() ?? 'image', file, deps)
}

/** Runs `work` over `items`, `limit` at a time. */
export async function inBatches<T>(items: T[], limit: number, work: (item: T) => Promise<void>) {
  for (let i = 0; i < items.length; i += limit) {
    await Promise.all(items.slice(i, i + limit).map(work))
  }
}

export type HostedImage = { url: string; width: number | null; height: number | null }
export type HostedVideo = { url: string; poster: HostedImage | null }

/** What the import copied from the old store: images by Files name, videos by Files name. */
export type Hosted = { images: Map<string, HostedImage>; videos: Map<string, HostedVideo> }

export const SHOP_VIDEO = /^shopify:\/\/files\/videos\/(.+)$/

/** Every `shopify://files/videos/...` name inside a JSON value. */
export function collectShopVideos(value: unknown, into: Set<string>): void {
  if (typeof value === 'string') {
    const m = SHOP_VIDEO.exec(value)
    if (m?.[1]) into.add(m[1])
  } else if (Array.isArray(value)) for (const v of value) collectShopVideos(v, into)
  else if (value && typeof value === 'object')
    for (const v of Object.values(value)) collectShopVideos(v, into)
}

/** One `<video>` on the live page: its mp4 and poster, both on the store's CDN. */
export type LiveVideo = { src: string; poster: string | null }

/** The videos inside one section of the live page's HTML, in page order. */
function liveVideosIn(html: string, sectionKey: string): LiveVideo[] {
  const start = html.search(
    new RegExp(`id="shopify-section-[^"]*__${sectionKey.replace(/[^\w-]/g, '')}"`),
  )
  if (start === -1) return []
  const next = html.indexOf('id="shopify-section-', start + 20)
  const chunk = html.slice(start, next === -1 ? undefined : next)
  const out: LiveVideo[] = []
  for (const m of chunk.matchAll(/<video\b([^>]*)>([\s\S]*?)<\/video>/g)) {
    const src = /<source[^>]*\bsrc="([^"]+\.mp4[^"]*)"/.exec(m[2] ?? '')?.[1]
    if (!src) continue
    const poster = /\bposter="([^"]+)"/.exec(m[1] ?? '')?.[1] ?? null
    const abs = (u: string) => (u.startsWith('//') ? `https:${u}` : u).replace(/&amp;/g, '&')
    out.push({ src: abs(src), poster: poster ? abs(poster) : null })
  }
  return out
}

/** Video setting values of a section in render order: its own settings, then enabled blocks. */
function videoNamesOf(section: ShopifyJsonTemplate['sections'][string]): string[] {
  const names: string[] = []
  const take = (settings: Record<string, unknown> | undefined) => {
    for (const v of Object.values(settings ?? {})) {
      const m = typeof v === 'string' ? /^shopify:\/\/files\/videos\/(.+)$/.exec(v) : null
      if (m?.[1]) names.push(m[1])
    }
  }
  take(section.settings)
  for (const id of section.block_order ?? Object.keys(section.blocks ?? {})) {
    const b = section.blocks?.[id]
    if (b && !b.disabled) take(b.settings)
  }
  return names
}

/** Downloads one file into storage and Files; the stored public URL. */
async function storeFile(
  tx: StoreTx,
  storeId: string,
  name: string,
  file: { bytes: Uint8Array; contentType: string },
  deps: ThemeImportDeps,
): Promise<HostedImage> {
  const id = newId()
  const key = mediaKey({ storeId, filename: name, contentType: file.contentType, id })
  await deps.storage.put({ key, body: file.bytes, contentType: file.contentType })
  const size = file.contentType.startsWith('image/')
    ? await (deps.imageSize ?? sharpSize)(file.bytes).catch(() => null)
    : null
  const url = deps.storage.publicUrl(key)
  await tx.insert(media).values({
    id,
    storeId,
    url,
    key,
    provider: deps.storage.id,
    contentType: file.contentType,
    size: file.bytes.byteLength,
    alt: null,
    width: size?.width ?? null,
    height: size?.height ?? null,
    status: 'ready',
  })
  return { url, width: size?.width ?? null, height: size?.height ?? null }
}

/**
 * Copies the videos a template's sections use from the live store's home page: the
 * n-th video setting of a section is the n-th `<video>` inside that section on the page
 * (the header and footer groups are on it too).
 */
export async function copyLiveVideos(
  tx: StoreTx,
  storeId: string,
  page: string,
  tpl: ShopifyJsonTemplate,
  hosted: Hosted,
  failed: string[],
  deps: ThemeImportDeps,
): Promise<void> {
  const wanted = tpl.order.flatMap((key) => {
    const section = tpl.sections[key]
    return section && !section.disabled ? [{ key, names: videoNamesOf(section) }] : []
  })
  for (const { key, names } of wanted) {
    const videos = liveVideosIn(page, key)
    for (const [i, name] of names.entries()) {
      const live = videos[i]
      if (hosted.videos.has(name)) continue
      if (!live) {
        failed.push(`${name}: not found on the live page`)
        continue
      }
      try {
        const file = await download(live.src, deps, 'video')
        if (!file) throw new Error('video is larger than 100 MB')
        const video = await storeFile(tx, storeId, name, file, deps)
        const posterFile = live.poster ? await download(live.poster, deps).catch(() => null) : null
        const poster = posterFile
          ? await storeFile(tx, storeId, `${name}-poster.jpg`, posterFile, deps)
          : null
        hosted.videos.set(name, { url: video.url, poster })
      } catch (err) {
        failed.push(`${name}: ${err instanceof Error ? err.message : String(err)}`)
      }
    }
  }
}

/** The live store's page HTML (capped), or why it could not be read. */
export async function livePage(
  host: string,
  path: string,
  deps: ThemeImportDeps,
): Promise<{ html: string } | { problem: string }> {
  try {
    const get = () =>
      safeFetch(`https://${host}${path}`, {
        timeoutMs: 30_000,
        ...(deps.fetch ? { fetch: deps.fetch } : {}),
        ...(deps.lookup ? { lookup: deps.lookup } : {}),
      })
    let res = await get()
    if (res.status === 429) {
      // Shopify's rate limit: wait as asked (up to 10 s) and try once more.
      await res.body?.cancel()
      const wait = Math.min(10, Number(res.headers.get('retry-after')) || 3)
      await new Promise((resolve) => setTimeout(resolve, wait * 1000))
      res = await get()
    }
    if (!res.ok) {
      await res.body?.cancel()
      return { problem: `the page answered ${res.status}` }
    }
    const bytes = await readCapped(res, 8 * 1024 * 1024)
    return bytes ? { html: new TextDecoder().decode(bytes) } : { problem: 'the page is too large' }
  } catch (err) {
    return { problem: err instanceof Error ? err.message : String(err) }
  }
}

/** The store's connected Shopify importer address (`shop.myshopify.com`), or null. */
export async function connectedShopifyHost(tx: StoreTx): Promise<string | null> {
  const rows = await tx.execute<{ shop_domain: string }>(
    sql`select shop_domain from shopify_import_connection limit 1`,
  )
  return rows[0]?.shop_domain ?? null
}

const baseName = (path: string) => {
  const last = path.split(/[?#]/)[0]?.split('/').pop() ?? ''
  try {
    return decodeURIComponent(last).toLowerCase()
  } catch {
    return last.toLowerCase()
  }
}

/**
 * Files the Shopify importer already copied into Files, for the names a theme refers to.
 * The importer records every file by its CDN address (resource `media`; the last part is
 * the image's file name) and videos also by their Shopify file name (resource
 * `file_name`). A name matching either reuses the copy and downloads nothing.
 */
export async function findImportedMedia(
  tx: StoreTx,
  imageNames: Iterable<string>,
  videoNames: Iterable<string>,
): Promise<Hosted> {
  const images = new Map<string, HostedImage>()
  const videos = new Map<string, HostedVideo>()
  const wantedImages = new Map([...imageNames].map((n) => [baseName(n), n]))
  const wantedVideos = new Map([...videoNames].map((n) => [baseName(n), n]))
  if (wantedImages.size === 0 && wantedVideos.size === 0) return { images, videos }
  const rows = await tx.execute<{
    resource: string
    source_id: string
    url: string
    width: number | null
    height: number | null
    content_type: string
  }>(sql`select m.resource, m.source_id, md.url, md.width, md.height, md.content_type
    from shopify_import_mapping m join media md on md.id = m.local_id
    where m.resource in ('media', 'file_name') and md.status = 'ready'`)
  for (const r of rows) {
    const key = r.resource === 'file_name' ? r.source_id.toLowerCase() : baseName(r.source_id)
    const image = wantedImages.get(key)
    if (image && r.content_type.startsWith('image/') && !images.has(image))
      images.set(image, { url: r.url, width: r.width, height: r.height })
    const video = wantedVideos.get(key)
    if (video && r.content_type.startsWith('video/') && !videos.has(video))
      videos.set(video, { url: r.url, poster: null })
  }
  return { images, videos }
}
