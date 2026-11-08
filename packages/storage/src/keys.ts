/**
 * SOURCE OF TRUTH KEYWORDS: IMAGE_MAX_UPLOAD_BYTES, VIDEO_MAX_UPLOAD_BYTES, maxUploadBytesFor,
 *   RETURN_PHOTO_MAX_BYTES, ALLOWED_CONTENT_TYPES, upload limits
 * WHAT:  Object keys and upload limits.
 * WHY:   Kept pure (and exported as `@commerce/storage/keys`) so the API, the admin's client-side
 *        gate and every adapter agree on what a valid upload is; the admin once allowed 25 MB
 *        while the server refused images over 10 MB.
 * WHERE: Core media service, Shopify import, admin `lib/upload.ts`, storefront return photos.
 */

/**
 * 10 MB for images: the upload-time pipeline (see @commerce/core media
 * pipeline) re-encodes every image server-side, so the original only needs
 * to survive one decode; a stray 20 MB phone photo is still comfortably
 * under this. 100 MB for the one accepted video type (mp4): big enough for
 * a real product demo clip, small enough a stray upload cannot fill a
 * bucket. Kept as per-type limits (`maxUploadBytesFor`) rather than one
 * shared ceiling because images and video have very different honest sizes.
 */
export const IMAGE_MAX_UPLOAD_BYTES = 10 * 1024 * 1024
export const VIDEO_MAX_UPLOAD_BYTES = 100 * 1024 * 1024

/** A shopper's return photo (JPG, PNG or WebP), checked in the browser and in the server action. */
export const RETURN_PHOTO_MAX_BYTES = 5 * 1024 * 1024

/**
 * What the media library accepts. Videos are mp4 only; browsers and CDNs
 * agree on it. SVG is deliberately excluded: it is XML that can carry
 * `<script>` and event handlers, so accepting it means serving stored XSS to
 * anyone who opens the uploaded file (see `apps/admin/.../uploads/[...key]/route.ts`,
 * which serves any surviving legacy `.svg` as a download, never inline).
 */
export const ALLOWED_CONTENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
  'video/mp4',
])

export function isAllowedContentType(contentType: string): boolean {
  return ALLOWED_CONTENT_TYPES.has(contentType.toLowerCase())
}

export const isImageContentType = (contentType: string): boolean =>
  contentType.toLowerCase().startsWith('image/')

/** The size ceiling for this content type: images 10 MB, mp4 video 100 MB. */
export function maxUploadBytesFor(contentType: string): number {
  return isImageContentType(contentType) ? IMAGE_MAX_UPLOAD_BYTES : VIDEO_MAX_UPLOAD_BYTES
}

const EXTENSION_BY_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
  'video/mp4': 'mp4',
}

/** Lowercase, ascii, dashes; the original name survives only as a hint in the key. */
export function safeFilename(name: string): string {
  const base = name.replace(/\.[a-z0-9]+$/i, '')
  const slug = base
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .toLowerCase()
    .slice(0, 60)
  return slug || 'file'
}

export type MediaKeyInput = {
  storeId: string
  filename: string
  contentType: string
  /** Injected for deterministic tests; production passes a uuid. */
  id: string
}

/**
 * `stores/<store>/media/<id>-<name>.<ext>`. The store prefix means a bucket
 * policy or a lifecycle rule can target one tenant; the id keeps names unique
 * without ever consulting the bucket.
 */
export function mediaKey(input: MediaKeyInput): string {
  const ext = EXTENSION_BY_TYPE[input.contentType.toLowerCase()] ?? 'bin'
  return `stores/${input.storeId}/media/${input.id}-${safeFilename(input.filename)}.${ext}`
}

/** True when a key belongs to the given store; route handlers use it to refuse cross-tenant writes. */
export function keyBelongsToStore(key: string, storeId: string): boolean {
  return key.startsWith(`stores/${storeId}/`) && !key.includes('..')
}

/**
 * `Cache-Control` for media whose bytes never change at their key: a year, in browsers and the
 * CDN, without asking again. Media keys carry a fresh id (`mediaKey`), and the processed files the
 * pipeline writes (the cleaned master, its `-w<width>` variants) are final.
 */
export const MEDIA_CACHE_CONTROL = 'public, max-age=31536000, immutable'

/**
 * The `Cache-Control` a write gets: the caller's, else a year for a video under a media key (a
 * video is stored as it came and never rewritten), else none. An image under a media key gets
 * none until the pipeline rewrites it: its first bytes are the original, EXIF and GPS included,
 * which no cache may keep.
 */
export function cacheControlFor(input: {
  key: string
  contentType: string
  cacheControl?: string | undefined
}): string | undefined {
  if (input.cacheControl) return input.cacheControl
  const isMedia = /^(?:.*\/)?stores\/[^/]+\/media\//.test(input.key)
  return isMedia && input.contentType.toLowerCase().startsWith('video/')
    ? MEDIA_CACHE_CONTROL
    : undefined
}
