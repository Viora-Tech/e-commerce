/**
 * SOURCE OF TRUTH: which field a click on the canvas means — WHAT: `fieldForClick` matches what
 * was clicked (an image's address, or the words of a heading, paragraph or button) against the
 * selected block's props / WHY: blocks render their props without marking them, so clicking
 * "Summer sale" on the canvas finds the prop that holds "Summer sale" and the inspector jumps to
 * it, like Shopify's editor. Pure, so it is tested without a canvas.
 */

export type ClickTarget = {
  /** The clicked image's address (`src`, or the URL inside a Next image link). */
  image: string | null
  /** The clicked element's words. */
  text: string
}

export type FieldHit = { field: string; image: boolean }

/** Words as compared: tags dropped, entities and spacing squashed, lower case. */
export function plainText(value: string): string {
  return value
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

/**
 * One picture's name, whatever size or format the page asked for: `/_next/image?url=...` is
 * unwrapped, and `photo-640.webp`, `photo_1280w.avif` and `photo.jpg` all read `photo`.
 */
export function pictureName(url: string): string {
  try {
    const u = new URL(url, 'https://canvas.invalid')
    const inner = u.searchParams.get('url')
    const path =
      inner && u.pathname.includes('/_next/image') ? new URL(inner, u).pathname : u.pathname
    const file = decodeURIComponent(path.split('/').pop() ?? '')
    return file
      .replace(/\.[a-z0-9]+$/i, '')
      .replace(/[-_@](\d{2,4})w?$/i, '')
      .toLowerCase()
  } catch {
    return ''
  }
}

const imageUrlOf = (value: unknown): string | null => {
  if (typeof value === 'string')
    return /\.(jpe?g|png|webp|avif|gif|svg)(\?|$)/i.test(value) ? value : null
  if (value && typeof value === 'object' && typeof (value as { url?: unknown }).url === 'string') {
    return (value as { url: string }).url
  }
  return null
}

const textsIn = (value: unknown): string[] => {
  if (typeof value === 'string') return [value]
  if (Array.isArray(value)) return value.flatMap(textsIn)
  if (value && typeof value === 'object') return Object.values(value).flatMap(textsIn)
  return []
}

const imagesIn = (value: unknown): string[] => {
  const own = imageUrlOf(value)
  if (own) return [own]
  if (Array.isArray(value)) return value.flatMap(imagesIn)
  if (value && typeof value === 'object') return Object.values(value).flatMap(imagesIn)
  return []
}

/** Props the inspector never shows: the block's id and the editor's own `_` keys. */
const editable = (props: Record<string, unknown>) =>
  Object.entries(props).filter(([k]) => k !== 'id' && !k.startsWith('_'))

/**
 * The prop a click means, or null. An image matches the prop holding the same picture (a list
 * prop such as slides matches as the list, and is not an image field). Words match the prop whose
 * text is the same; failing that, the prop whose text contains them or that they contain, the
 * closest in length winning. Very short words (one or two letters) never match a part.
 */
export function fieldForClick(
  props: Record<string, unknown>,
  target: ClickTarget,
): FieldHit | null {
  const fields = editable(props)
  if (target.image) {
    const wanted = pictureName(target.image)
    if (wanted) {
      for (const [field, value] of fields) {
        const own = imageUrlOf(value)
        if (own && pictureName(own) === wanted) return { field, image: true }
      }
      for (const [field, value] of fields) {
        if (imagesIn(value).some((u) => pictureName(u) === wanted)) return { field, image: false }
      }
    }
  }
  const words = plainText(target.text)
  if (!words) return null
  let best: { field: string; gap: number } | null = null
  for (const [field, value] of fields) {
    for (const raw of textsIn(value)) {
      const text = plainText(raw)
      if (!text) continue
      if (text === words) return { field, image: false }
      const part =
        words.length > 2 && text.length > 2 && (text.includes(words) || words.includes(text))
      const gap = Math.abs(text.length - words.length)
      if (part && (!best || gap < best.gap)) best = { field, gap }
    }
  }
  return best ? { field: best.field, image: false } : null
}
