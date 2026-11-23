import type { TemplateData } from '../types'
import type { ResolvedBlock } from './resolve'
import { richToPlain } from './rich-text'
import type { CellBlock, FreeBlock } from './types'
import { fillVariables } from './variables'

/** The words of an HTML block, without its tags. */
function htmlToPlain(html: string): string {
  return html
    .replace(/<(br|\/p|\/div|\/h[1-4]|\/li|\/tr)\b[^>]*>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

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
  const f = (t: string) => fillVariables(t, d)
  const link = (label: string, url: string) => {
    const u = f(url).trim()
    if (u) push(label ? `${f(label)}: ${u}` : u)
  }
  const one = (b: FreeBlock | CellBlock) => {
    if (b.type === 'heading') push(f(b.text))
    else if (b.type === 'text') push(b.rich ? richToPlain(f(b.text)) : f(b.text))
    else if (b.type === 'button') link(b.label, b.url)
    else if (b.type === 'image' && b.href) link(b.alt, b.href)
  }
  for (const r of blocks) {
    if (r.kind !== 'free') continue
    const b = r.block
    if (b.type === 'hero') {
      push(f(b.heading), f(b.text))
      if (b.buttonUrl) link(b.buttonLabel, b.buttonUrl)
    } else if (b.type === 'products') {
      const shop = d.brand?.shopUrl?.replace(/\/$/, '')
      push(
        f(b.title),
        ...b.items.map((p) =>
          [p.title, b.showPrice ? p.priceLabel : '', shop ? `${shop}/products/${p.handle}` : '']
            .filter(Boolean)
            .join(' · '),
        ),
      )
    } else if (b.type === 'coupon') push(`${f(b.label) || 'Code'}: ${f(b.code)}`, f(b.note))
    else if (b.type === 'video') link(b.label, b.url)
    else if (b.type === 'html') push(htmlToPlain(f(b.html)))
    else if (b.type === 'columns') for (const c of b.cells.flat()) one(c)
    else one(b)
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
