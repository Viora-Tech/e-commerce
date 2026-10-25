/** The Files tabs besides All; they filter by the file's type. */
export const FILE_TABS = ['image', 'video', 'document'] as const
export type FileTab = (typeof FILE_TABS)[number]

/** "1.2 MB", "840 KB": file sizes in the units the Files screens show. */
export function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1000))} KB`
}

/** The media id `mediaKey` puts before the name (`<uuid>-<name>.<ext>`). */
const ID_PREFIX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i

/**
 * The file's own name: the last part of its storage key (or address), without the media id
 * the upload put in front of it or any query string.
 */
export function fileName(key: string): string {
  const last = key.split(/[?#]/)[0]?.split('/').pop() || key
  return last.replace(ID_PREFIX, '')
}

/** "JPG", "PNG", "MP4": the short type label under a file. */
export function fileKind(contentType: string | null): string {
  const sub = contentType?.split('/')[1]?.split('+')[0]
  if (!sub) return ''
  return (sub === 'jpeg' ? 'jpg' : sub).toUpperCase()
}

const TYPE_BY_EXTENSION: Record<string, string> = {
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
 * The file's type, or a guess from its extension when none was saved (files brought in by the
 * Shopify import have no content type).
 */
export function contentTypeOf(contentType: string | null, address: string): string | null {
  if (contentType) return contentType
  const ext = fileName(address).split('.').pop()?.toLowerCase() ?? ''
  return TYPE_BY_EXTENSION[ext] ?? null
}
