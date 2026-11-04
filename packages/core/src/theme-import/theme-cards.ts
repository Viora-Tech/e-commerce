/** SOURCE OF TRUTH: an imported theme's own product card on our collection grid — WHAT: finds, in the theme's main collection section, the `{% render %}` call that draws each product of `collection.products` (`card-product`, `product-card`…) with the section's own `assign`s it reads, and builds one template that draws that card for a list of product handles, split per card / WHY: our main collection section replaces the theme's (filters, sort and paging run on ours), but its cards must be the theme's: its rating, sale pill, quick add, compare and image dots. The card's forms post to our cart like every other theme form (swap.ts `cart_add`) */
import type { ThemeBundle } from './bundle'

/** A main collection section as the import kept it on our `MainCollection` (`_themeSections`). */
export type ThemeCardSection = {
  /** The section's type (`main-collection-product-grid`). */
  type: string
  /** Its key in the theme's template (`product-grid`), for Shopify's `section.id`. */
  key: string
  /** Its saved settings, as the import stored them. */
  settings: Record<string, unknown>
}

/** What the card render needs: the section it comes from and the template drawing the cards. */
type ThemeCardTemplate = {
  section: ThemeCardSection
  /** Parse-cache key for the built template. */
  cacheKey: string
  /** The built template: stylesheets, the section's assigns, then one card per handle. */
  source: string
}

/** Shopify's built-in card snippets, tried when no section's loop names one we can read. */
const FALLBACK_SNIPPETS = ['card-product', 'product-card', 'product-item', 'card-product-grid']

/** Separates one card's markup from the next in the built template's output. */
const CARD_MARK = '<!--commerce-theme-card-->'

/** The list of handles the built template walks. */
export const CARD_HANDLES = '_commerce_card_handles'

/** Longest render tag read: real ones are a few hundred characters. */
const TAG_MAX = 2000

/** Scripts the card needs for its own buttons (Dawn's quick add modal and product form). */
const CARD_SCRIPT = /quick[-_]?add|product[-_]form/i

/** `{% for <var> in collection.products %}` (or `paginate`d `collection.products`). */
const PRODUCT_LOOP = /\bfor\s+(\w+)\s+in\s+collection\.products\b/

/** The render call inside the loop: `{% render 'card-product', card_product: product… %}`. */
function renderCall(
  source: string,
  from: number,
  loopVar: string,
  snippets: Map<string, string>,
): string | null {
  const re = /\brender\s+(['"])([\w.-]+)\1/g
  re.lastIndex = from
  for (let m = re.exec(source); m; m = re.exec(source)) {
    if (!snippets.has(m[2] ?? '')) continue
    const open = source.lastIndexOf('{%', m.index)
    const inTag = open !== -1 && /^{%-?\s*$/.test(source.slice(open, m.index))
    // A `{% render %}` tag runs to its `%}`; inside `{% liquid %}` the call is one line.
    const stop = inTag ? source.indexOf('%}', m.index) : source.indexOf('\n', m.index)
    const end = stop === -1 ? Math.min(source.length, m.index + TAG_MAX) : stop
    if (end - m.index > TAG_MAX) continue
    const call = source.slice(m.index, end).replace(/-\s*$/, '').replace(/\s+/g, ' ').trim()
    if (new RegExp(`\\b${loopVar}\\b`).test(call.slice(m[0].length))) return call
  }
  return null
}

/** The section's `assign x = section.settings.y` (and `settings.y`) lines the card call may read. */
function settingAssigns(source: string): string[] {
  const out: string[] = []
  const re = /\bassign\s+(\w+)\s*=\s*((?:section\.)?settings\.\w+[^\n%}]*)/g
  for (const m of source.matchAll(re)) {
    const expr = (m[2] ?? '').replace(/-\s*$/, '').trim()
    if (expr) out.push(`{%- assign ${m[1]} = ${expr} -%}`)
  }
  return out
}

/** The section's stylesheets (and the card's own scripts), drawn once above the cards. */
function sectionAssets(source: string): string[] {
  const out: string[] = []
  for (const m of source.matchAll(
    /{{-?\s*(['"])[^'"]+\1\s*\|\s*asset_url\s*\|\s*stylesheet_tag[^}]{0,200}}}/g,
  ))
    out.push(m[0])
  for (const m of source.matchAll(/<link\b[^<>]{0,400}asset_url[^<>]{0,400}>/g)) {
    if (/stylesheet/.test(m[0])) out.push(m[0])
  }
  for (const m of source.matchAll(/<script\b[^<>]{0,400}asset_url[^<>]{0,400}><\/script>/g)) {
    if (CARD_SCRIPT.test(m[0])) out.push(m[0])
  }
  return out
}

/**
 * The theme's own stylesheets for the product section ours replaces (`section-product.css`…).
 * Its class names are ours, so the page keeps the theme's look; they are only ever linked by
 * that section, which never renders here. Files the theme does not hold are left out.
 */
export function mainProductStylesheets(bundle: ThemeBundle): string[] {
  const source = bundle.sections.get('main-product')?.source ?? ''
  const names = sectionAssets(source).flatMap((tag) => tag.match(/[\w.-]+\.css/g) ?? [])
  return [...new Set(names)].filter((file) => bundle.assets.has(file))
}

/** The main collection sections to look in: the ones the import kept, then the theme's own. */
function candidates(bundle: ThemeBundle, kept: ThemeCardSection[]): ThemeCardSection[] {
  const own = [...bundle.sections.keys()]
    .filter((t) => /^main-collection|^collection-template|^main-product-grid/.test(t))
    .sort()
    .map((type) => ({ type, key: type, settings: {} }))
  return [...kept, ...own]
}

/**
 * The template that draws the theme's product card for `CARD_HANDLES`, each card after a
 * `CARD_MARK`; null when the theme draws no card we can find (our own card stays).
 */
export function themeCardTemplate(
  bundle: ThemeBundle,
  kept: ThemeCardSection[] = [],
): ThemeCardTemplate | null {
  for (const section of candidates(bundle, kept)) {
    const source = bundle.sections.get(section.type)?.source
    if (!source) continue
    const loop = PRODUCT_LOOP.exec(source)
    if (!loop?.[1]) continue
    const call = renderCall(source, loop.index, loop[1], bundle.snippets)
    if (!call) continue
    return {
      section,
      cacheKey: `theme-cards/${section.type}`,
      source: build(sectionAssets(source), settingAssigns(source), loop[1], call),
    }
  }
  const snippet = FALLBACK_SNIPPETS.find((s) => bundle.snippets.has(s))
  if (!snippet) return null
  const call = `render '${snippet}', card_product: product, product: product, show_quick_add: true, quick_add: 'standard', show_rating: true`
  return {
    section: { type: '', key: 'main', settings: {} },
    cacheKey: `theme-cards/@${snippet}`,
    source: build([], [], 'product', call),
  }
}

function build(assets: string[], assigns: string[], loopVar: string, call: string): string {
  return [
    ...assets,
    ...assigns,
    `{%- for _commerce_handle in ${CARD_HANDLES} -%}`,
    `{%- assign ${loopVar} = all_products[_commerce_handle] -%}`,
    `${CARD_MARK}{%- if ${loopVar} -%}{%- ${call} -%}{%- endif -%}`,
    '{%- endfor -%}',
  ].join('\n')
}

/** The built template's output as the head (stylesheets) and one card's markup per handle. */
export function splitThemeCards(html: string, count: number): { head: string; cards: string[] } {
  const [head = '', ...cards] = html.split(CARD_MARK)
  return {
    head: head.trim(),
    cards: Array.from({ length: count }, (_, i) => (cards[i] ?? '').trim()),
  }
}
