/**
 * Object keys and upload limits. Kept pure so the API, the admin and every
 * adapter agree on what a valid upload is without sharing runtime code.
 */

/** 25 MB: enough for a product video, small enough that a stray upload cannot fill a bucket. */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024

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
