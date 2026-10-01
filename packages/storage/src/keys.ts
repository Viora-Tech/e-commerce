/**
 * Object keys and upload limits. Kept pure so the API, the admin and every
 * adapter agree on what a valid upload is without sharing runtime code.
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
