import type { MediaItem } from './form-state'

/** Videos stay on the product; a variant's images are pictures only. */
export function isVariantImage(item: Pick<MediaItem, 'contentType'>): boolean {
  return !item.contentType || item.contentType.startsWith('image/')
}

/** Adds the id at the end, or takes it out when it is already chosen. */
export function toggleId(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((i) => i !== id) : [...ids, id]
}

/** Moves the item at `from` one place earlier (-1) or later (+1); out of range leaves it. */
export function moveId(ids: string[], from: number, step: -1 | 1): string[] {
  const to = from + step
  if (from < 0 || from >= ids.length || to < 0 || to >= ids.length) return ids
  const next = [...ids]
  const [moved] = next.splice(from, 1)
  if (moved !== undefined) next.splice(to, 0, moved)
  return next
}

/** The chosen ids that are still in the gallery, in their chosen order. */
export function chosenItems(ids: string[], media: MediaItem[]): MediaItem[] {
  return ids.flatMap((id) => media.find((m) => m.id === id) ?? [])
}
