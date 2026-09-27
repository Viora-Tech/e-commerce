import type { MediaItem } from '@/components/media/media-pick-types'

/**
 * The media picker's "Recently used" strip: the last few files picked in this
 * browser. A convenience only (localStorage), so it reads defensively and
 * quietly does nothing where storage is blocked.
 */
const KEY = 'media.pick.recent'
export const RECENT_MEDIA_MAX = 6

/** The recent list after picking `picked`: newest first, one entry per file, capped. */
export function pushRecentMedia(
  list: readonly MediaItem[],
  picked: readonly MediaItem[],
  max = RECENT_MEDIA_MAX,
): MediaItem[] {
  const ids = new Set(picked.map((m) => m.id))
  return [...picked, ...list.filter((m) => !ids.has(m.id))].slice(0, max)
}

export function parseRecentMedia(raw: string | null): MediaItem[] {
  if (!raw) return []
  try {
    const value = JSON.parse(raw) as unknown
    if (!Array.isArray(value)) return []
    return value
      .filter(
        (m): m is MediaItem =>
          typeof m === 'object' &&
          m !== null &&
          typeof (m as MediaItem).id === 'string' &&
          typeof (m as MediaItem).url === 'string',
      )
      .slice(0, RECENT_MEDIA_MAX)
  } catch {
    return []
  }
}

export function readRecentMedia(): MediaItem[] {
  try {
    return parseRecentMedia(window.localStorage.getItem(KEY))
  } catch {
    return []
  }
}

export function rememberMedia(picked: readonly MediaItem[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(pushRecentMedia(readRecentMedia(), picked)))
  } catch {
    // Storage blocked: the strip just stays empty.
  }
}
