/** SOURCE OF TRUTH: rendering an imported Shopify theme — WHAT: a theme bundle (its files, parsed once), the global Liquid objects for a request (shop, settings, routes, request, collections, linklists, cart...), settings typed by their schema, and the section / theme-block / layout renders the storefront and the editor canvas call / WHY: every imported section, on every page and in Customize, renders through this one path, so they all see the same data and look the same */
import type { Liquid, Template } from 'liquidjs'
import { LiquidDataCache } from './cache'
import {
  AllProductsDrop,
  ArticleDrop,
  BlogDrop,
  BlogsDrop,
  CollectionDrop,
  CollectionsDrop,
  ColorDrop,
  ColorSchemeDrop,
  cartDrop,
  FontDrop,
  imageDrop,
  LIQUID_ROUTES,
  type LiquidDataSource,
  LinklistDrop,
  LinklistsDrop,
  PageDrop,
  PagesDrop,
  ProductDrop,
} from './drops'
import { createThemeEngine, type EngineRuntime } from './engine'
import { escapeAttr } from './filters'
import {
  extractSchema,
  isValueSetting,
  parseThemeJson,
  type ShopifySectionSchema,
  type ShopifySetting,
  settingDefaults,
  withoutSchema,
} from './schema'

/** A theme's files as the renderer needs them; built once per theme version and cached. */
export type ThemeBundle = {
  themeId: string
  /** Changes whenever the theme's files or settings change; part of every cache key. */
  version: string
  sections: Map<string, { source: string; schema: ShopifySectionSchema | null }>
  blocks: Map<string, { source: string; schema: ShopifySectionSchema | null }>
  snippets: Map<string, string>
  layout: string | null
  /** `locales/<default>.json`. */
  locale: Record<string, unknown>
  /** `locales/<default>.schema.json`, for setting labels in the editor. */
  schemaLocale: Record<string, unknown>
  /** `config/settings_schema.json`: groups of theme settings. */
  settingsSchema: { name?: string; settings?: ShopifySetting[] }[]
  /** Current theme settings (`settings_data.json`), as imported. */
  settings: Record<string, unknown>
  /** `assets/<file>` → checksum, for versioned URLs. */
  assets: Map<string, string>
  /** Text assets (`.css`, `.js`, `.svg`), for `inline_asset_content`. */
  assetText: (file: string) => string | null
}

/** Text files of a theme, by path, plus asset checksums: what `buildThemeBundle` reads. */
export type ThemeBundleInput = {
  themeId: string
  version: string
  textFiles: Map<string, string>
  assetChecksums: Map<string, string>
  settings: Record<string, unknown>
}

const nameOf = (path: string, folder: string, ext: string) =>
  path.startsWith(`${folder}/`) && path.endsWith(ext)
    ? path.slice(folder.length + 1, -ext.length)
    : null

/** The default locale file among `locales/*.json` (`en.default.json`), and its schema twin. */
function defaultLocale(files: Map<string, string>, schema: boolean): Record<string, unknown> {
  const suffix = schema ? '.default.schema.json' : '.default.json'
  for (const [path, text] of files) {
    if (path.startsWith('locales/') && path.endsWith(suffix)) {
      return parseThemeJson<Record<string, unknown>>(text) ?? {}
    }
  }
  return {}
}

/**
 * Shopify allows `comment … endcomment` inside a `{% liquid %}` tag; LiquidJS reads
 * every line there as a tag, so those comment lines are dropped before parsing.
 */
export function normalizeLiquid(source: string): string {
  return source.replace(/{%-?\s*liquid\b([\s\S]*?)-?%}/g, (whole, body: string) => {
    if (!/^\s*comment\s*$/m.test(body)) return whole
    const lines = body.split('\n')
    const kept: string[] = []
    let depth = 0
    for (const line of lines) {
      const t = line.trim()
      if (t === 'comment') depth += 1
      else if (t === 'endcomment' && depth > 0) depth -= 1
      else if (depth === 0) kept.push(line)
    }
    return whole.replace(body, kept.join('\n'))
  })
}

export function buildThemeBundle(input: ThemeBundleInput): ThemeBundle {
  const sections = new Map<string, { source: string; schema: ShopifySectionSchema | null }>()
  const blocks = new Map<string, { source: string; schema: ShopifySectionSchema | null }>()
  const snippets = new Map<string, string>()
  for (const [path, raw] of input.textFiles) {
    const text = path.endsWith('.liquid') ? normalizeLiquid(raw) : raw
    const section = nameOf(path, 'sections', '.liquid')
    if (section) sections.set(section, { source: withoutSchema(text), schema: extractSchema(text) })
    const block = nameOf(path, 'blocks', '.liquid')
    if (block) blocks.set(block, { source: withoutSchema(text), schema: extractSchema(text) })
    const snippet = nameOf(path, 'snippets', '.liquid')
    if (snippet) snippets.set(snippet, text)
  }
  const schemaText = input.textFiles.get('config/settings_schema.json')
  return {
    themeId: input.themeId,
    version: input.version,
    sections,
    blocks,
    snippets,
    layout: normalizeLiquid(input.textFiles.get('layout/theme.liquid') ?? '') || null,
    locale: defaultLocale(input.textFiles, false),
    schemaLocale: defaultLocale(input.textFiles, true),
    settingsSchema: (schemaText ? parseThemeJson<ThemeBundle['settingsSchema']>(schemaText) : null) ?? [],
    settings: input.settings,
    assets: input.assetChecksums,
    assetText: (file) => input.textFiles.get(`assets/${file}`) ?? null,
  }
}

/** Parsed templates per theme version: parsing is the slow half of a render. */
type EngineEntry = { version: string; engine: Liquid; parsed: Map<string, Template[]> }
const engines = new Map<string, EngineEntry>()
const MAX_ENGINES = 8

function engineFor(bundle: ThemeBundle): EngineEntry {
  const hit = engines.get(bundle.themeId)
  if (hit && hit.version === bundle.version) return hit
  const entry = { version: bundle.version, engine: createThemeEngine(bundle.snippets), parsed: new Map() }
  engines.delete(bundle.themeId)
  engines.set(bundle.themeId, entry)
  while (engines.size > MAX_ENGINES) {
    const oldest = engines.keys().next().value
    if (oldest === undefined) break
    engines.delete(oldest)
  }
  return entry
}

function parsed(entry: EngineEntry, key: string, source: string): Template[] {
  const hit = entry.parsed.get(key)
  if (hit) return hit
  const tpl = entry.engine.parse(source, key)
  entry.parsed.set(key, tpl)
  return tpl
}

/** What a page render knows about the request. */
export type LiquidRequest = {
  /** `index`, `product`, `collection`... (Shopify's `template.name`). */
  template: string
  path: string
  host: string
  origin: string
  /** True in the editor canvas: themes show placeholders and skip some scripts. */
  designMode: boolean
  /** `?form_posted=<type>` after one of our form handlers redirected back. */
  postedForm: string | null
  /** CSP nonce for inline scripts on the storefront; blank in the editor. */
  nonce: string
}

export type LiquidRenderOptions = {
  bundle: ThemeBundle
  data: LiquidDataSource
  request: LiquidRequest
  /** `asset_url` base: `/theme-assets/<theme>` on the storefront, absolute in the editor. */
  assetBase: string
  /** The merchant's old Shopify host, for `file_url`. */
  shopifyHost: string | null
  /** Shopify `money_format` (theme import option); null formats with @commerce/money. */
  moneyFormat: string | null
  /** Payment marks the footer shows (`shop.enabled_payment_types`). */
  paymentTypes: string[]
}

/** One section placed in a template or group, as Puck data keeps it (see `liquid-data.ts`). */
export type LiquidSectionInput = {
  id: string
  type: string
  settings: Record<string, unknown>
  blocks: { id: string; type: string; settings: Record<string, unknown>; disabled?: boolean | undefined }[]
  /** `template` or the group name, e.g. `header-group`. */
  location: string
  index: number
}

/** Shopify's resource links (`shopify://collections/x`) as our paths. */
export function shopifyUrlToPath(value: string): string {
  const m = /^shopify:\/\/(products|collections|pages|blogs|articles|search|policies)\/?(.*)$/.exec(
    value,
  )
  if (!m) return value
  const [, kind, rest = ''] = m
  if (kind === 'search') return '/search'
  if (kind === 'policies') return `/policies/${rest}`
  if (kind === 'articles') return `/blogs/${rest}`
  return `/${kind}/${rest}`
}

/** A `video_url` setting: `{ type: 'youtube', id }`, printing as the URL. */
function videoUrl(value: string): Record<string, unknown> | null {
  if (!value) return null
  const yt = /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{6,})/.exec(value)
  if (yt) return { type: 'youtube', id: yt[1], url: value }
  const vimeo = /vimeo\.com\/(?:video\/)?(\d+)/.exec(value)
  if (vimeo) return { type: 'vimeo', id: vimeo[1], url: value }
  return { type: null, id: null, url: value }
}

const handlesOf = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string' && v !== '') : []

/**
 * A setting's stored value as the theme reads it: image settings become image
 * objects, product settings products, colours colour objects, and so on.
 */
export function liquidSettingValue(
  setting: ShopifySetting,
  value: unknown,
  data: LiquidDataCache,
  themeSettings: Record<string, unknown>,
): unknown {
  const text = typeof value === 'string' ? value : ''
  switch (setting.type) {
    case 'image_picker': {
      if (value && typeof value === 'object' && 'url' in value) {
        const v = value as { url: unknown; alt?: unknown; width?: unknown; height?: unknown }
        return typeof v.url === 'string' && v.url && !v.url.startsWith('shopify://')
          ? imageDrop({
              url: v.url,
              alt: typeof v.alt === 'string' ? v.alt : '',
              width: typeof v.width === 'number' ? v.width : null,
              height: typeof v.height === 'number' ? v.height : null,
            })
          : null
      }
      return text && !text.startsWith('shopify://') ? imageDrop({ url: text }) : null
    }
    case 'product': {
      const found = text ? data.product(text) : null
      return found ? new ProductDrop(found) : null
    }
    case 'product_list':
      return handlesOf(value).flatMap((h) => {
        const p = data.product(h)
        return p ? [new ProductDrop(p)] : []
      })
    case 'collection': {
      const found = text ? data.collection(text) : null
      return found ? new CollectionDrop(found, data) : null
    }
    case 'collection_list':
      return handlesOf(value).flatMap((h) => {
        const c = data.collection(h)
        return c ? [new CollectionDrop(c, data)] : []
      })
    case 'link_list': {
      const menu = text ? data.menu(text) : null
      return menu ? new LinklistDrop(menu) : null
    }
    case 'blog': {
      const blog = text ? data.blog(text) : null
      return blog ? new BlogDrop(blog) : null
    }
    case 'article': {
      const [blogHandle, articleHandle] = text.split('/')
      const blog = blogHandle ? data.blog(blogHandle) : null
      const article = blog?.articles.find((a) => a.handle === articleHandle)
      return article ? new ArticleDrop(article) : null
    }
    case 'page': {
      const page = text ? data.page(text) : null
      return page ? new PageDrop(page) : null
    }
    case 'color':
      return text ? new ColorDrop(text) : null
    case 'color_scheme': {
      const schemes = (themeSettings.color_schemes ?? {}) as Record<string, { settings?: Record<string, unknown> }>
      const scheme = schemes[text]
      return scheme ? new ColorSchemeDrop(text, scheme.settings ?? {}) : text
    }
    case 'font_picker':
      return text ? new FontDrop(text) : null
    case 'url':
      return text ? shopifyUrlToPath(text) : null
    case 'video_url':
      return videoUrl(text)
    case 'video':
    case 'metaobject':
    case 'metaobject_list':
      return null
    default:
      return value
  }
}

/** Every setting a schema declares, defaults filled in, values typed for Liquid. */
export function liquidSettings(
  schema: ShopifySetting[] | undefined,
  values: Record<string, unknown>,
  data: LiquidDataCache,
  themeSettings: Record<string, unknown>,
): Record<string, unknown> {
  const merged = { ...settingDefaults(schema), ...values }
  const out: Record<string, unknown> = { ...merged }
  for (const s of (schema ?? []).filter(isValueSetting)) {
    out[s.id] = liquidSettingValue(s, merged[s.id], data, themeSettings)
  }
  return out
}

/** Theme settings (`settings`), typed by `settings_schema.json`; loads what they point at. */
async function themeSettingsFor(bundle: ThemeBundle, cache: LiquidDataCache) {
  const schema = bundle.settingsSchema.flatMap((g) => g.settings ?? [])
  let settings = liquidSettings(schema, bundle.settings, cache, bundle.settings)
  if (cache.missing) {
    await cache.fill()
    settings = liquidSettings(schema, bundle.settings, cache, bundle.settings)
  }
  return settings
}

/** The Shopify globals one request renders with, shared by every section on the page. */
export type LiquidPageContext = {
  bundle: ThemeBundle
  entry: EngineEntry
  globals: Record<string, unknown>
  runtime: EngineRuntime
  options: LiquidRenderOptions
  /** The request's data, read synchronously by renders (see `cache.ts`). */
  cache: LiquidDataCache
}

export async function createPageContext(options: LiquidRenderOptions): Promise<LiquidPageContext> {
  const { bundle, data, request } = options
  const entry = engineFor(bundle)
  const collectionList = await data.collections()
  const cart = await data.cart()
  const cache = new LiquidDataCache(data, collectionList)
  const settings = await themeSettingsFor(bundle, cache)
  const runtime: EngineRuntime = {
    assetUrl: (file) => {
      const clean = file.replace(/^\/+/, '')
      const sum = bundle.assets.get(clean)
      return `${options.assetBase}/${clean.split('/').map(encodeURIComponent).join('/')}${sum ? `?v=${sum}` : ''}`
    },
    assetText: bundle.assetText,
    locale: bundle.locale,
    currency: 'INR',
    moneyFormat: options.moneyFormat,
    fonts: new Map(),
    nonce: request.nonce,
    shopifyHost: options.shopifyHost,
    postedForm: request.postedForm,
  }
  const shop = data.shop
  const globals: Record<string, unknown> = {
    _rt: runtime,
    settings,
    shop: {
      name: shop.name,
      email: shop.email,
      phone: shop.phone,
      domain: shop.domain,
      permanent_domain: shop.domain,
      url: shop.url,
      secure_url: shop.url,
      currency: shop.currency,
      money_format: options.moneyFormat ?? '₹{{amount}}',
      money_with_currency_format: `${options.moneyFormat ?? '₹{{amount}}'} INR`,
      description: shop.description,
      locale: 'en',
      enabled_currencies: [{ iso_code: shop.currency, symbol: '₹' }],
      enabled_payment_types: options.paymentTypes,
      published_locales: [{ iso_code: 'en', name: 'English', primary: true }],
      policies: [],
      privacy_policy: { url: '/policies/privacy-policy', title: 'Privacy policy' },
      refund_policy: { url: '/policies/refund-policy', title: 'Refund policy' },
      shipping_policy: { url: '/policies/shipping-policy', title: 'Shipping policy' },
      terms_of_service: { url: '/policies/terms-of-service', title: 'Terms of service' },
      customer_accounts_enabled: true,
      customer_accounts_optional: true,
      types: [],
      vendors: [],
      metafields: {},
      brand: { logo: null, colors: {}, short_description: shop.description },
    },
    routes: LIQUID_ROUTES,
    request: {
      design_mode: request.designMode,
      visual_preview_mode: false,
      page_type: request.template,
      path: request.path,
      host: request.host,
      origin: request.origin,
      locale: { iso_code: 'en', name: 'English', primary: true, root_url: '/' },
    },
    localization: {
      language: { iso_code: 'en', name: 'English', endonym_name: 'English', root_url: '/' },
      country: { iso_code: 'IN', name: 'India', currency: { iso_code: 'INR', symbol: '₹', name: 'Indian Rupee' } },
      available_languages: [{ iso_code: 'en', name: 'English', endonym_name: 'English' }],
      available_countries: [{ iso_code: 'IN', name: 'India', currency: { iso_code: 'INR', symbol: '₹' } }],
    },
    template: { name: request.template, suffix: null, directory: null },
    theme: { id: bundle.themeId, name: 'Imported theme', role: 'main' },
    collections: new CollectionsDrop(cache),
    all_products: new AllProductsDrop(cache),
    linklists: new LinklistsDrop(cache),
    blogs: new BlogsDrop(cache),
    pages: new PagesDrop(cache),
    cart: cartDrop(cart),
    customer: null,
    content_for_header: '',
    content_for_index: '',
    powered_by_link: '',
    canonical_url: `${request.origin}${request.path}`,
    page_title: shop.name,
    page_description: shop.description,
    handle: '',
    current_page: 1,
    current_tags: [],
    search: { performed: false, results: [], results_count: 0, terms: '', types: [], filters: [] },
    predictive_search: { performed: false, resources: {}, terms: '' },
    recommendations: { performed: false, products: [], products_count: 0 },
    additional_checkout_buttons: false,
    images: {},
    scripts: null,
  }
  return { bundle, entry, globals, runtime, options, cache }
}

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
  const tag = schema?.tag && /^(div|section|article|aside|header|footer|nav)$/.test(schema.tag) ? schema.tag : 'div'
  return { tag, id: `shopify-section-${section.id}`, className: `shopify-section${group}${extra}` }
}

export class LiquidRenderProblem extends Error {}

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
  const stored = (bundle.settings.sections ?? {}) as Record<string, { settings?: Record<string, unknown> }>
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
      const spec = italic ? `ital,wght@${list.join(';')}` : `wght@${list.map((a) => a.split(',')[1]).join(';')}`
      return `family=${encodeURIComponent(family).replace(/%20/g, '+')}:${spec}`
    })
    .join('&')
  return `https://fonts.googleapis.com/css2?${query}&display=swap`
}
