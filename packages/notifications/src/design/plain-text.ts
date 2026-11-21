import type { TemplateData } from '../types'
import type { ResolvedBlock } from './resolve'
import { fillVariables } from './variables'

/**
 * The merchant's own words from a design, for the plain-text part: headings, paragraphs,
 * buttons and linked images as "label: url", in the design's order. The built-in parts keep
 * their full text around these lines.
 */
export function designTextLines(blocks: ResolvedBlock[], d: TemplateData): string[] {
  const lines: string[] = []
  const push = (...l: string[]) => {
    const kept = l.map((x) => x.trim()).filter(Boolean)
    if (kept.length > 0) lines.push('', ...kept)
  }
  for (const r of blocks) {
    if (r.kind !== 'free') continue
    const b = r.block
    if (b.type === 'heading') push(fillVariables(b.text, d))
    else if (b.type === 'text') push(fillVariables(b.text, d))
    else if (b.type === 'button') {
      const url = fillVariables(b.url, d).trim()
      if (url) push(`${fillVariables(b.label, d)}: ${url}`)
    } else if (b.type === 'image' && b.href) {
      const url = fillVariables(b.href, d).trim()
      if (url) push(b.alt ? `${fillVariables(b.alt, d)}: ${url}` : url)
    }
  }
  return lines
}

/** The intro's own words when the merchant changed them; undefined keeps the built-in. */
export function introOverride(
  blocks: ResolvedBlock[],
  d: TemplateData,
): { heading?: string | undefined; lead?: string | undefined } {
  const intro = blocks.find((r) => r.kind === 'intro')
  if (intro?.kind !== 'intro') return {}
  const own = (v: string | undefined) => (v ? fillVariables(v, d).trim() || undefined : undefined)
  return { heading: own(intro.block.heading), lead: own(intro.block.lead) }
}
