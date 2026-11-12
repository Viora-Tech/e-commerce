/**
 * Puts the buy box island into our section's markup. The section is drawn through the same block
 * config as on Next (`renderBlock`), with `ISLAND_MARK` where the buy box goes; the island is
 * rendered on its own (the tree the browser hydrates) and replaces the mark. That only works when
 * the mark is all the section drew, or all its `section-frame` div holds: then the island's
 * element (the wrapper, or the frame) holds the island and nothing else, which is what
 * `hydrateRoot` needs. Anything else (a section's custom CSS beside it) returns null, and the
 * page goes to Next.
 */

export const ISLAND_MARK = 'hono-island-mark-7f3a9c'

const FRAMED = new RegExp(`^(<div\\b[^>]*\\bclass="section-frame[^"]*"[^>]*>)${ISLAND_MARK}</div>$`)

export function placeIsland(
  shell: string,
  island: string,
): { html: string; framed: boolean } | null {
  if (shell === ISLAND_MARK) return { html: island, framed: false }
  const open = FRAMED.exec(shell)?.[1]
  return open ? { html: `${open}${island}</div>`, framed: true } : null
}

const LEADING_PRELOADS = /^(?:<link rel="preload"[^>]*\/?>)+/

/**
 * React writes preload links for the gallery's first image ahead of the markup; Next moves them
 * into `<head>`. They go there here too, so the island's element holds only what it hydrates.
 */
export function splitPreloads(html: string): { preloads: string; body: string } {
  const preloads = LEADING_PRELOADS.exec(html)?.[0] ?? ''
  return { preloads, body: html.slice(preloads.length) }
}
