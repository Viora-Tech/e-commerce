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

/** Words a stored name is often left with that say nothing about the file. */
const GENERIC = new Set(['image', 'img', 'file', 'photo', 'picture', 'video'])

/** A long run of digits (a timestamp) or a hash-like token mixing letters and digits. */
const isNoise = (token: string) =>
  /^\d{6,}$/.test(token) ||
  (token.length >= 8 && /\d/.test(token) && /^[a-z0-9]+$/i.test(token)) ||
  token.toLowerCase() === 'original'

/**
 * A readable name from a storage key, for files saved before names were kept (#91):
 * "…/<id>-1789453878-a1b2c3d4e5-red-mouse-pad-original.jpg" → "Red mouse pad". Null when
 * nothing readable is left.
 */
export function readableKeyName(key: string): string | null {
  const stem = fileName(key).replace(/\.[a-z0-9]{1,5}$/i, '')
  const words = stem
    .split(/[-_\s]+/)
    .filter((t) => t && !isNoise(t))
    .join(' ')
    .trim()
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : null
}

/**
 * What Files calls a file (#91): the saved name (the uploaded file's own, or a rename), else one
 * read from its key; a key that leaves only "image" gives way to the alt text. The key and URL
 * never change.
 */
export function displayName(file: {
  name?: string | null | undefined
  key: string | null
  alt: string | null
  url?: string | undefined
}): string {
  const saved = file.name?.trim()
  if (saved) return saved
  const fromKey = readableKeyName(file.key ?? file.url ?? '')
  const alt = file.alt?.trim()
  if (alt && (!fromKey || GENERIC.has(fromKey.toLowerCase()))) return alt
  return fromKey ?? (file.key ? fileName(file.key) : '')
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
