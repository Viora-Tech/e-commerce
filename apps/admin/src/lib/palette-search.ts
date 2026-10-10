/**
 * Pure helpers for the ⌘K palette: scopes, text highlighting, word matching, the "recent"
 * list and list-page links. No React, no fetching, so each is unit-tested on its own.
 */

export const PALETTE_SCOPES = [
  'all',
  'orders',
  'products',
  'customers',
  'pages',
  'settings',
] as const
export type PaletteScope = (typeof PALETTE_SCOPES)[number]

/** The scope after (`1`) or before (`-1`) this one, wrapping at both ends (Tab / Shift+Tab). */
export function cycleScope(scope: PaletteScope, step: 1 | -1): PaletteScope {
  const index = PALETTE_SCOPES.indexOf(scope)
  const next = (index + step + PALETTE_SCOPES.length) % PALETTE_SCOPES.length
  return PALETTE_SCOPES[next] ?? 'all'
}

/** The words typed, lowercase, without empties. */
export function queryWords(query: string): string[] {
  return query.toLowerCase().split(/\s+/).filter(Boolean)
}

/** True when every typed word appears in at least one of the texts. An empty query matches. */
export function matchesWords(texts: readonly (string | undefined)[], query: string): boolean {
  const words = queryWords(query)
  if (words.length === 0) return true
  const haystack = texts.join(' ').toLowerCase()
  return words.every((w) => haystack.includes(w))
}

export type TextPart = { text: string; match: boolean }

/** `text` cut into parts, the parts that contain a typed word marked, for highlighting. */
export function highlightParts(text: string, query: string): TextPart[] {
  const words = queryWords(query.replace(/^#/, ''))
  if (!text || words.length === 0) return [{ text, match: false }]
  const lower = text.toLowerCase()
  const marked = new Array<boolean>(text.length).fill(false)
  for (const word of words) {
    let from = lower.indexOf(word)
    while (from !== -1) {
      for (let i = from; i < from + word.length; i++) marked[i] = true
      from = lower.indexOf(word, from + word.length)
    }
  }
  const parts: TextPart[] = []
  for (let i = 0; i < text.length; i++) {
    const match = marked[i] === true
    const last = parts[parts.length - 1]
    if (last && last.match === match) last.text += text[i]
    else parts.push({ text: text[i] ?? '', match })
  }
  return parts
}

/** The full list page with the search applied (`/orders?query=ali`). */
export function searchHref(listHref: string, query: string): string {
  return `${listHref}?query=${encodeURIComponent(query)}`
}

/** "Taxes & GST › GST & invoices" is already a trail under Settings; a bare "Settings" is not. */
export function settingsBreadcrumb(where: string, root: string, separator: string): string {
  if (where === 'Settings' || where === root) return root
  return `${root}${separator}${where}`
}

/** One thing the member recently opened or searched, kept in this browser only. */
export type RecentEntry = { label: string; href: string; hint?: string }

export const MAX_RECENTS = 6

/** The saved list back, dropping anything that is not a well-formed entry. */
export function parseRecents(raw: string | null): RecentEntry[] {
  if (!raw) return []
  try {
    const value: unknown = JSON.parse(raw)
    if (!Array.isArray(value)) return []
    return value
      .filter(
        (e): e is RecentEntry =>
          typeof e === 'object' &&
          e !== null &&
          typeof (e as RecentEntry).label === 'string' &&
          typeof (e as RecentEntry).href === 'string' &&
          (e as RecentEntry).href.startsWith('/'),
      )
      .slice(0, MAX_RECENTS)
  } catch {
    return []
  }
}

/** `entry` first, any earlier copy of the same page removed, capped at `MAX_RECENTS`. */
export function pushRecent(list: readonly RecentEntry[], entry: RecentEntry): RecentEntry[] {
  return [entry, ...list.filter((e) => e.href !== entry.href)].slice(0, MAX_RECENTS)
}
