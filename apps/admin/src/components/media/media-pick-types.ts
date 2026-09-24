export type MediaItem = {
  id: string
  url: string
  alt: string | null
  key: string | null
  contentType: string | null
  size: number | null
  usedBy?: number
}

export type PickedMedia = {
  id: string
  url: string
  alt: string | null
  contentType: string | null
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
