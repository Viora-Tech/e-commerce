/** SOURCE OF TRUTH: a file's MIME type guessed from its name or URL extension — for rows imported without one (see migration 0148 and `usage.ts`, which apply the same map in SQL). Pure, client-safe. */

/** Lowercase extension → MIME type. Only the kinds Files sorts into images, videos and documents. */
export const CONTENT_TYPE_BY_EXTENSION: Readonly<Record<string, string>> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  pdf: 'application/pdf',
}

/**
 * The MIME type a file name, storage key or URL implies by its extension, ignoring any
 * `?query` or `#hash` (Shopify CDN URLs end in `?v=…`); null when it has none we know.
 * A guess from the name only: never use it to decide whether downloaded bytes are safe.
 */
export function contentTypeFromName(name: string): string | null {
  const path = name.split(/[?#]/, 1)[0] ?? ''
  const file = path.slice(path.lastIndexOf('/') + 1)
  const dot = file.lastIndexOf('.')
  if (dot <= 0) return null
  return CONTENT_TYPE_BY_EXTENSION[file.slice(dot + 1).toLowerCase()] ?? null
}
