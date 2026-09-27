export type MediaItem = {
  id: string
  url: string
  alt: string | null
  key: string | null
  contentType: string | null
  size: number | null
  usedBy?: number
  /** Responsive AVIF/WebP widths from the upload pipeline; null until processed. */
  variants?: MediaVariants | null | undefined
  /** Base64 ThumbHash for the blur-up placeholder; null until processed. */
  thumbhash?: string | null | undefined
}

export type MediaVariants = Record<string, { avif: string; webp: string }>

export type PickedMedia = {
  id: string
  url: string
  alt: string | null
  contentType: string | null
  variants?: MediaVariants | null | undefined
  thumbhash?: string | null | undefined
}

/** What a pick hands back: the item's own fields, including its preview data. */
export function pickedFrom(item: MediaItem): PickedMedia {
  return {
    id: item.id,
    url: item.url,
    alt: item.alt,
    contentType: item.contentType,
    variants: item.variants ?? null,
    thumbhash: item.thumbhash ?? null,
  }
}

export function filenameFrom(key: string | null): string {
  if (!key) return ''
  return key.split('/').pop() ?? key
}

export function isVideoMedia(contentType: string | null): boolean {
  return contentType?.startsWith('video/') ?? false
}

export function extLabel(item: MediaItem): string {
  const fromType = item.contentType?.split('/')[1]
  if (fromType) return fromType.replace('svg+xml', 'svg').toUpperCase()
  const name = filenameFrom(item.key)
  const ext = name.includes('.') ? name.split('.').pop() : null
  return ext ? ext.toUpperCase() : ''
}

export function formatMediaSize(bytes: number | null): string {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function matchesMediaQuery(item: MediaItem, needle: string): boolean {
  if (!needle) return true
  const haystack = `${item.alt ?? ''} ${filenameFrom(item.key)}`.toLowerCase()
  return haystack.includes(needle)
}
