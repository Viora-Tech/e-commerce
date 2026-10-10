/** SOURCE OF TRUTH: rendering an imported Shopify theme — WHAT: the section, theme-block and layout renders the storefront and the editor canvas call (synchronous passes over the request's data cache), Shopify's section wrappers and the layout split around `<main>` / WHY: every imported section, on every page and in Customize, renders through this one path */
import { parsed, type ThemeBundle } from './bundle'
import type { FontDrop } from './drops'
import { type EngineRuntime, renderBounded } from './engine'
import { escapeAttr } from './filters'
import type { LiquidPageContext, LiquidSectionInput } from './page-context'
import type { ShopifySectionSchema } from './schema'
import { liquidSettings } from './settings-values'

/** Liquid-ready blocks: settings typed by the block schema, disabled ones left out. */
function sectionBlocks(
  ctx: LiquidPageContext,
  schema: ShopifySectionSchema | null,
  section: LiquidSectionInput,
): Record<string, unknown>[] {
  const themeSettings = ctx.bundle.settings
  const shown = section.blocks.filter((b) => !b.disabled && !b.type.startsWith('@app'))
  return shown.map((b) => {
    const local = schema?.blocks?.find((s) => s.type === b.type)
    const themeBlock = ctx.bundle.blocks.get(b.type)?.schema
    const blockSchema = local?.settings ?? themeBlock?.settings
    return {
      id: b.id,
      type: b.type,
      settings: liquidSettings(blockSchema, b.settings, ctx.cache, themeSettings),
      shopify_attributes: `data-block-id="${escapeAttr(b.id)}"`,
      blocks: [],
    }
  })
}

/** The `section` object a section's Liquid reads. */
function sectionObject(ctx: LiquidPageContext, section: LiquidSectionInput) {
  const schema = ctx.bundle.sections.get(section.type)?.schema ?? null
  return {
    id: section.id,
    index: section.index + 1,
    index0: section.index,
    location: section.location,
    settings: liquidSettings(schema?.settings, section.settings, ctx.cache, ctx.bundle.settings),
    blocks: sectionBlocks(ctx, schema, section),
  }
}

/**
 * Renders synchronously until the data cache has everything the template asked for:
 * each pass notes what was missing, the cache loads it, the next pass has it. Most
 * sections need two passes; a product inside a collection a third.
 */
async function renderUntilComplete(ctx: LiquidPageContext, pass: () => string): Promise<string> {
  let html = ''
  for (let i = 0; i < MAX_PASSES; i++) {
    let failure: unknown = null
    try {
      html = pass()
    } catch (err) {
      failure = err
    }
    if (!ctx.cache.missing) {
      if (failure) throw failure
      return html
    }
    await ctx.cache.fill()
  }
  return pass()
}

/** Passes before a render settles for what it has (a chain of lookups deeper than this is rare). */
const MAX_PASSES = 5

/** Shopify's wrapper around every section; group sections carry the group's class. */
export function sectionWrapper(
  bundle: ThemeBundle,
  section: Pick<LiquidSectionInput, 'id' | 'type' | 'location'>,
): { tag: string; id: string; className: string } {
  const schema = bundle.sections.get(section.type)?.schema
  const group = section.location !== 'template' ? ` shopify-section-group-${section.location}` : ''
  const extra = schema?.class ? ` ${schema.class}` : ''
  const tag =
    schema?.tag && /^(div|section|article|aside|header|footer|nav)$/.test(schema.tag)
      ? schema.tag
      : 'div'
  return { tag, id: `shopify-section-${section.id}`, className: `shopify-section${group}${extra}` }
}

/**
 * One section's inner HTML (the storefront and the canvas draw Shopify's wrapper
 * element themselves, see `sectionWrapper`). A section that fails renders a comment
 * instead of taking the page down; `onError` hears about it.
 */
export async function renderLiquidSection(
  ctx: LiquidPageContext,
  section: LiquidSectionInput,
  onError?: (err: unknown) => void,
): Promise<string> {
  const def = ctx.bundle.sections.get(section.type)
  if (!def) return `<!-- section ${escapeAttr(section.type)} is not in this theme -->`
  try {
    const runtime = withHooks(ctx)
    const tpl = parsed(ctx.entry, `sections/${section.type}.liquid`, def.source)
    return await renderUntilComplete(ctx, () =>
      renderBounded(
        ctx.entry.engine,
        ctx.budget,
        tpl,
        { section: sectionObject(ctx, section) },
        { ...ctx.globals, _rt: runtime },
      ),
    )
  } catch (err) {
    onError?.(err)
    return `<!-- section ${escapeAttr(section.type)} could not render -->`
  }
}

/** Runtime hooks for one render: static sections and theme blocks call back into this module. */
function withHooks(ctx: LiquidPageContext): EngineRuntime {
  return {
    ...ctx.runtime,
    renderStaticSection: (type) => {
      const def = ctx.bundle.sections.get(type)
      if (!def) return ''
      const section = {
        id: type,
        type,
        settings: staticSectionSettings(ctx.bundle, type),
        blocks: [],
        location: 'template',
        index: 0,
      }
      const wrapper = sectionWrapper(ctx.bundle, section)
      const tpl = parsed(ctx.entry, `sections/${type}.liquid`, def.source)
      const html = renderBounded(
        ctx.entry.engine,
        ctx.budget,
        tpl,
        { section: sectionObject(ctx, section) },
        { ...ctx.globals, _rt: withHooks(ctx) },
      )
      return `<${wrapper.tag} id="${wrapper.id}" class="${wrapper.className}">${html}</${wrapper.tag}>`
    },
    renderThemeBlock: (block, section, liquidCtx) => {
      const b = block as { type?: string }
      const def = b.type ? ctx.bundle.blocks.get(b.type) : undefined
      if (!def || !b.type) return ''
      const tpl = parsed(ctx.entry, `blocks/${b.type}.liquid`, def.source)
      return renderBounded(ctx.entry.engine, ctx.budget, tpl, { block, section }, liquidCtx.globals)
    },
  }
}

/** A static section's settings: `settings_data.json` keeps them under `sections`. */
function staticSectionSettings(bundle: ThemeBundle, type: string): Record<string, unknown> {
  const stored = (bundle.settings.sections ?? {}) as Record<
    string,
    { settings?: Record<string, unknown> }
  >
  return stored[type]?.settings ?? {}
}

/** Where `{% sections %}` and `content_for_layout` sit in the rendered layout. */
const MARK = {
  header: '<!--liquid:header-group-->',
  footer: '<!--liquid:footer-group-->',
  content: '<!--liquid:content-->',
}

/** The page shell around the sections: what the storefront puts in and around `<main>`. */
export type LiquidLayoutParts = {
  /** `<head>` contents minus title/meta/canonical (the storefront owns SEO). */
  head: string
  /** `<html>` attributes (`lang`, `class`, `data-*`). */
  htmlAttrs: Record<string, string>
  /** `<body>` attributes. */
  bodyAttrs: Record<string, string>
  /** Body markup before the header group (icon sprites, skip link). */
  beforeHeader: string
  /** Body markup after the footer group (cart drawer, scripts). */
  afterFooter: string
  /** `<main>` attributes the theme sets. */
  mainAttrs: Record<string, string>
  /** Google Fonts the theme's `font_face` calls asked for. */
  fonts: FontDrop[]
}

/** Longest attribute text read from `<html>`, `<body>` or `<main>`; real ones are a few hundred. */
const ATTRS_MAX = 10_000

function attrsOf(tag: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const m of tag
    .slice(0, ATTRS_MAX)
    .matchAll(/([\w:-]+)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g)) {
    const name = m[1]?.toLowerCase()
    if (!name || name === 'html' || name === 'body' || name === 'main') continue
    out[name] = m[3] ?? m[4] ?? m[5] ?? ''
  }
  return out
}

/*
 * The layout split below reads markup the theme wrote, so it never uses a pattern that can
 * backtrack over the whole output (`[^>]*` or `[\s\S]*?` with nothing to stop it): a layout
 * of `<head<head<head…` with no `>` would make those quadratic and hold the server. Each
 * helper finds a fixed string, then the next `>` or closing tag, and moves forward.
 */

/** The first `<name …>` at or after `from`: where it starts and ends, and its attribute text. */
function openTag(
  html: string,
  name: string,
  from = 0,
): { start: number; end: number; attrs: string } | null {
  const re = new RegExp(`<${name}\\b`, 'gi')
  re.lastIndex = from
  const m = re.exec(html)
  if (!m) return null
  const close = html.indexOf('>', m.index)
  if (close === -1) return null
  return { start: m.index, end: close + 1, attrs: html.slice(m.index + m[0].length, close) }
}

/** Where `</name>` starts, at or after `from`; -1 when there is none. */
function closeTag(html: string, name: string, from = 0): number {
  const re = new RegExp(`</${name}>`, 'gi')
  re.lastIndex = from
  return re.exec(html)?.index ?? -1
}

/** Head tags the storefront writes itself (SEO and the viewport): `<title>`, `<meta>`, canonical. */
function withoutOwnHead(head: string): string {
  type Found = { name: 'title' | 'meta' | 'link'; tag: NonNullable<ReturnType<typeof openTag>> }
  // The next tag of each name, kept until passed, so each name's search only moves forward.
  const ahead = new Map<Found['name'], Found | null>()
  let out = ''
  let at = 0
  for (;;) {
    for (const name of ['title', 'meta', 'link'] as const) {
      const known = ahead.get(name)
      if (known === null || (known && known.tag.start >= at)) continue
      const tag = openTag(head, name, at)
      ahead.set(name, tag ? { name, tag } : null)
    }
    const next = [...ahead.values()]
      .filter((f): f is Found => f !== null)
      .sort((a, b) => a.tag.start - b.tag.start)[0]
    if (!next) break
    let end = next.tag.end
    // A `<title>` with no `</title>` is left as it is (so is everything after it).
    const titleEnd = next.name === 'title' ? closeTag(head, 'title', end) : -1
    if (titleEnd !== -1) end = titleEnd + '</title>'.length
    const drop =
      next.name === 'meta' ||
      (next.name === 'title' && titleEnd !== -1) ||
      (next.name === 'link' && /\brel\s*=\s*["']?canonical/i.test(next.tag.attrs))
    out += head.slice(at, drop ? next.tag.start : end)
    at = end
  }
  return out + head.slice(at)
}

/** Renders `layout/theme.liquid` around markers and splits it into the parts around `<main>`. */
export async function renderLiquidLayout(
  ctx: LiquidPageContext,
  onError?: (err: unknown) => void,
): Promise<LiquidLayoutParts> {
  const empty: LiquidLayoutParts = {
    head: '',
    htmlAttrs: {},
    bodyAttrs: {},
    beforeHeader: '',
    afterFooter: '',
    mainAttrs: {},
    fonts: [],
  }
  if (!ctx.bundle.layout) return empty
  const runtime: EngineRuntime = {
    ...withHooks(ctx),
    renderGroup: (name) =>
      name.startsWith('header') ? MARK.header : name.startsWith('footer') ? MARK.footer : '',
  }
  let html: string
  try {
    const tpl = parsed(ctx.entry, 'layout/theme.liquid', ctx.bundle.layout)
    html = await renderUntilComplete(ctx, () =>
      renderBounded(
        ctx.entry.engine,
        ctx.budget,
        tpl,
        { content_for_layout: MARK.content },
        { ...ctx.globals, _rt: runtime },
      ),
    )
  } catch (err) {
    // A layout that fails leaves the sections unstyled rather than the page down.
    onError?.(err)
    return empty
  }
  const htmlTag = openTag(html, 'html')
  const headTag = openTag(html, 'head')
  const headEnd = headTag ? closeTag(html, 'head', headTag.end) : -1
  const head = headTag && headEnd !== -1 ? html.slice(headTag.end, headEnd) : ''
  const bodyTag = openTag(html, 'body')
  const bodyStart = bodyTag ? bodyTag.end : 0
  const bodyEnd = closeTag(html, 'body', bodyStart)
  const body = html.slice(bodyStart, bodyEnd === -1 ? undefined : bodyEnd)
  const headerAt = body.indexOf(MARK.header)
  const footerAt = body.indexOf(MARK.footer)
  const mainTag = openTag(body, 'main')
  return {
    head: withoutOwnHead(head),
    htmlAttrs: attrsOf(htmlTag?.attrs ?? ''),
    bodyAttrs: attrsOf(bodyTag?.attrs ?? ''),
    beforeHeader: headerAt >= 0 ? body.slice(0, headerAt) : '',
    afterFooter: footerAt >= 0 ? body.slice(footerAt + MARK.footer.length) : '',
    mainAttrs: attrsOf(mainTag?.attrs ?? ''),
    fonts: [...ctx.runtime.fonts.values(), ...runtime.fonts.values()],
  }
}

/** A Google Fonts stylesheet for the theme's Shopify fonts (same families, served by Google). */
export function googleFontsHref(fonts: FontDrop[]): string | null {
  const families = new Map<string, Set<string>>()
  for (const f of fonts) {
    if (f.system) continue
    const set = families.get(f.family) ?? new Set<string>()
    set.add(`${f.style === 'italic' ? 1 : 0},${f.weight}`)
    families.set(f.family, set)
  }
  if (families.size === 0) return null
  const query = [...families]
    .map(([family, axes]) => {
      const list = [...axes].sort()
      const italic = list.some((a) => a.startsWith('1'))
      const spec = italic
        ? `ital,wght@${list.join(';')}`
        : `wght@${list.map((a) => a.split(',')[1]).join(';')}`
      return `family=${encodeURIComponent(family).replace(/%20/g, '+')}:${spec}`
    })
    .join('&')
  return `https://fonts.googleapis.com/css2?${query}&display=swap`
}
