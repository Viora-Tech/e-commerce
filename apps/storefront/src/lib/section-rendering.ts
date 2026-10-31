/**
 * Shopify's Section Rendering API as an imported theme's script asks for it (`lib/liquid-shim.ts`
 * sends it to `/theme-actions/section`): `?sections=a,b` answers JSON keyed by every section
 * asked for, `?section_id=` one section's HTML.
 */

/** Shopify answers at most this many sections in one `?sections=` request. */
export const MAX_SECTIONS = 5

const SECTION_ID = /^[a-z0-9_-]{1,80}$/i

/** Whether `id` can name a theme section: it goes into a file lookup, so nothing else is tried. */
export function validSectionId(id: string): boolean {
  return SECTION_ID.test(id)
}

/**
 * The sections a `?sections=` list asks for, in order, each once, capped at `MAX_SECTIONS`.
 * An id that cannot name a section stays in the list (it answers null) but is never rendered.
 */
export function requestedSections(list: string): string[] {
  const ids = list
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean)
  return [...new Set(ids)].slice(0, MAX_SECTIONS)
}
