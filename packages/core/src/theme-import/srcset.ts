/** SOURCE OF TRUTH: honest srcsets in imported themes — WHAT: rewrites each `srcset` / `imagesrcset` a theme wrote so our sized copies carry their real width, once each, smallest first / WHY: a theme writes `{{ img | image_url: width: 900 }} 900w` by hand, and we only keep a few widths, so the same 480 px copy went out as `600w, 900w, 1200w` and the browser could not tell a small file from a big one */

/** Our sized copies end `-w<width>.webp|avif` (`variantKey`), inside a store's `media/` folder. */
const SIZED_COPY = /\/media\/[^?#\s]*-w(\d+)\.(?:webp|avif)(?:[?#]|$)/

/** `srcset="…"`, `imagesrcset='…'`, `data-srcset="…"` (lazy-loading scripts swap it in). */
const SRCSET_ATTR = /(\s(?:data-)?(?:image)?srcset\s*=\s*)("[^"]*"|'[^']*')/gi

type Candidate = { url: string; width: number }

/** `a.webp 600w, b.webp 900w` → candidates; null when any is not a plain `<n>w` one. */
function parse(value: string): Candidate[] | null {
  const out: Candidate[] = []
  for (const part of value.split(/,(?=\s|$)/)) {
    const item = part.trim()
    if (!item) continue
    const m = /^(\S+)\s+(\d+)w$/.exec(item)
    if (!m) return null
    out.push({ url: m[1] as string, width: Number(m[2]) })
  }
  return out
}

/**
 * One srcset made honest: each of our sized copies described by its real width, a file listed
 * once, one file per width, smallest first. A list with anything we do not understand (an `x`
 * density, a URL with a comma) comes back as it was, and so does one with none of our copies.
 */
export function honestSrcset(value: string): string {
  const candidates = parse(value)
  if (!candidates || candidates.length === 0) return value
  let ours = false
  const real = candidates.map((c) => {
    const m = SIZED_COPY.exec(c.url)
    if (!m) return c
    ours = true
    return { url: c.url, width: Number(m[1]) }
  })
  if (!ours) return value
  const seenUrl = new Set<string>()
  const seenWidth = new Set<number>()
  const kept: Candidate[] = []
  for (const c of real) {
    if (seenUrl.has(c.url) || seenWidth.has(c.width)) continue
    seenUrl.add(c.url)
    seenWidth.add(c.width)
    kept.push(c)
  }
  kept.sort((a, b) => a.width - b.width)
  return kept.map((c) => `${c.url} ${c.width}w`).join(', ')
}

/** Every srcset in a rendered piece of theme markup, made honest (`honestSrcset`). */
export function honestSrcsets(html: string): string {
  if (!/srcset/i.test(html)) return html
  return html.replace(SRCSET_ATTR, (whole, lead: string, quoted: string) => {
    const quote = quoted[0] as string
    const inner = quoted.slice(1, -1)
    const fixed = honestSrcset(inner)
    return fixed === inner ? whole : `${lead}${quote}${fixed}${quote}`
  })
}
