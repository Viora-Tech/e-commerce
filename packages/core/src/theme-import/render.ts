/** SOURCE OF TRUTH: rendering an imported Shopify theme — WHAT: the section, theme-block and layout renders the storefront and the editor canvas call (synchronous passes over the request's data cache), Shopify's section wrappers and the layout split around `<main>` / WHY: every imported section, on every page and in Customize, renders through this one path */
import { parsed, type ThemeBundle } from './bundle'
import type { FontDrop } from './drops'
import type { EngineRuntime } from './engine'
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
      ctx.entry.engine.renderSync(
        tpl,
        { section: sectionObject(ctx, section) },
        { globals: { ...ctx.globals, _rt: runtime } },
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
      const html = ctx.entry.engine.renderSync(
        tpl,
        { section: sectionObject(ctx, section) },
        { globals: { ...ctx.globals, _rt: withHooks(ctx) } },
      )
      return `<${wrapper.tag} id="${wrapper.id}" class="${wrapper.className}">${html}</${wrapper.tag}>`
    },
    renderThemeBlock: (block, section, liquidCtx) => {
      const b = block as { type?: string }
      const def = b.type ? ctx.bundle.blocks.get(b.type) : undefined
      if (!def || !b.type) return ''
      const tpl = parsed(ctx.entry, `blocks/${b.type}.liquid`, def.source)
      return ctx.entry.engine.renderSync(tpl, { block, section }, { globals: liquidCtx.globals })
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

function attrsOf(tag: string): Record<string, string> {
  const out: Record<string, string> = {}
  for (const m of tag.matchAll(/([\w:-]+)(?:\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g)) {
    const name = m[1]?.toLowerCase()
    if (!name || name === 'html' || name === 'body' || name === 'main') continue
    out[name] = m[3] ?? m[4] ?? m[5] ?? ''
  }
  return out
}

/** Head tags the storefront writes itself: SEO and the viewport. */
const OWN_HEAD = /<title[\s\S]*?<\/title>|<meta\b[^>]*>|<link\b[^>]*rel=["']?canonical[^>]*>/gi

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
      ctx.entry.engine.renderSync(
        tpl,
        { content_for_layout: MARK.content },
        { globals: { ...ctx.globals, _rt: runtime } },
      ),
    )
  } catch (err) {
    // A layout that fails leaves the sections unstyled rather than the page down.
    onError?.(err)
    return empty
  }
  const htmlTag = /<html\b([^>]*)>/i.exec(html)
  const headMatch = /<head\b[^>]*>([\s\S]*?)<\/head>/i.exec(html)
  const bodyTag = /<body\b([^>]*)>/i.exec(html)
  const bodyStart = bodyTag ? bodyTag.index + bodyTag[0].length : 0
  const bodyEnd = html.search(/<\/body>/i)
  const body = html.slice(bodyStart, bodyEnd === -1 ? undefined : bodyEnd)
  const headerAt = body.indexOf(MARK.header)
  const footerAt = body.indexOf(MARK.footer)
  const mainTag = /<main\b([^>]*)>/i.exec(body)
  return {
    head: (headMatch?.[1] ?? '').replace(OWN_HEAD, ''),
    htmlAttrs: attrsOf(htmlTag?.[1] ?? ''),
    bodyAttrs: attrsOf(bodyTag?.[1] ?? ''),
    beforeHeader: headerAt >= 0 ? body.slice(0, headerAt) : '',
    afterFooter: footerAt >= 0 ? body.slice(footerAt + MARK.footer.length) : '',
    mainAttrs: attrsOf(mainTag?.[1] ?? ''),
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
