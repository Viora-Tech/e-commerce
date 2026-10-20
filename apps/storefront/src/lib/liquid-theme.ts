import 'server-only'
import {
  CollectionDrop,
  createPageContext,
  getCart,
  googleFontsHref,
  type LiquidCartData,
  type LiquidPageContext,
  type LiquidSectionInput,
  type RecommendationIntent,
  liquidPlacement,
  liquidSectionKey,
  loadTemplate,
  loadThemeBundle,
  loadThemeDraftBundle,
  mainThemeId,
  ProductDrop,
  peekThemeBundle,
  renderLiquidLayout,
  renderLiquidSection,
  resolveThemeProductId,
  sectionWrapper,
  storeLiquidData,
  type TemplateKey,
  type ThemeBundle,
  themeImportFor,
} from '@commerce/core'
import { product as productTable, type StoreTx } from '@commerce/db'
import { logger } from '@commerce/observability/logging'
import { reviewsLiquidSource } from '@commerce/plugin-reviews/server'
import { eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { cache } from 'react'
import { readCartId } from './cart-cookie'
import { NONCE_HEADER } from './csp'
import { formsInstalled } from './forms-context'
import {
  type CachedLiquid,
  keepable,
  type LiquidRenderScope,
  layoutCacheKey,
  NONCE_MARK,
  newTrace,
  type RenderTrace,
  renderTtl,
  sectionCacheKey,
  servable,
  traceCartReads,
  withNonce,
} from './liquid-cache'
import { cachedLiquidData } from './liquid-data-cache'
import { deferThemeScripts } from './liquid-defer'
import { belowTheFold } from './liquid-fold'
import { cartIsEmpty, requestCart } from './request-cart'
import { requestOrigin } from './seo'
import { CACHE_TTL_MS, cachedForStore, peekForStore, rememberForStore } from './store-cache'
import { inStore } from './store-context'
import { readPreview } from './storefront-gate'

/**
 * The storefront side of imported Shopify themes (`@commerce/core` theme-import): the
 * section HTML the `LiquidSection` renderer draws, and the layout parts (head, icon sprites,
 * cart drawer, scripts) the store layout puts around `<main>`.
 *
 * Rendered Liquid is cached per store version (`store-cache.ts`, `liquid-cache.ts`): a page
 * whose sections are all cached renders no Liquid and reads no theme data. Sections that read
 * the cart are kept only as rendered for an empty cart; a theme preview is never cached.
 */

/** Payment marks the theme's footer draws, from the methods this store offers. */
const PAYMENT_TYPES = ['upi', 'visa', 'master', 'rupay', 'american_express']

type CartView = NonNullable<Awaited<ReturnType<typeof getCart>>>

/** A cart in the shape Liquid reads; an empty one without a cart. */
function toLiquidCart(cart: CartView | null): LiquidCartData {
  if (!cart) return { itemCount: 0, totalPrice: 0, items: [] }
  return {
    itemCount: cart.itemCount,
    totalPrice: cart.subtotalPaise,
    items: cart.lines.map((l) => ({
      id: l.variantId,
      quantity: l.quantity,
      title: l.productTitle,
      price: l.unitPricePaise,
      linePrice: l.linePaise,
      product: null,
      variantTitle: l.variantTitle,
      image: l.imageUrl ? { url: l.imageUrl, alt: l.productTitle } : null,
      url: `/products/${l.productHandle}`,
    })),
  }
}

/** Shopify's `template.name` for a storefront path. */
export function liquidTemplateFor(path: string): string {
  if (path === '/' || path === '') return 'index'
  if (path.startsWith('/products/')) return 'product'
  if (path === '/collections' || path === '/collections/') return 'list-collections'
  if (path.startsWith('/collections/')) return 'collection'
  if (path.startsWith('/pages/')) return 'page'
  if (/^\/blogs\/[^/]+\/[^/]+/.test(path)) return 'article'
  if (path.startsWith('/blogs/')) return 'blog'
  if (path.startsWith('/cart')) return 'cart'
  if (path.startsWith('/search')) return 'search'
  if (path.startsWith('/account')) return 'customers/account'
  return '404'
}

/** What this request renders Liquid for: from the headers the proxy set, once per request. */
const requestScope = cache(async (storeId: string) => {
  const h = await headers()
  const path = h.get('x-pathname') ?? '/'
  const template = liquidTemplateFor(path)
  // Filters, sort and page shape a collection or search page's listing (`listingSearch`).
  const listing =
    template === 'collection' || template === 'search' ? (h.get('x-listing') ?? '') : ''
  return {
    origin: await requestOrigin(),
    path,
    listing,
    template,
    postedForm: h.get('x-form-posted'),
    nonce: h.get(NONCE_HEADER) ?? '',
    preview: readPreview(storeId, h.get('x-theme-preview')) !== null,
  }
})

type RequestScope = Awaited<ReturnType<typeof requestScope>>

/** `listingSearch` params as the Liquid listing reads them: one key, its values. */
function listingQuery(search: string): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  for (const [k, v] of new URLSearchParams(search)) (out[k] ??= []).push(v)
  return out
}

type ImportedTheme = { bundle: ThemeBundle; shopifyHost: string | null }

/** Runs `read` in `tx` when the caller holds one, else in a transaction of its own. */
function within<T>(storeId: string, tx: StoreTx | null, read: (tx: StoreTx) => Promise<T>) {
  return tx ? read(tx) : inStore(storeId, read)
}

/**
 * An imported theme's bundle, or null for one of our own themes. The import row's version is
 * cached per store version; the bundle itself is built once per theme version (core keeps it).
 * Pass `tx` when the caller already holds a transaction, so no second connection is taken.
 */
async function importedTheme(
  storeId: string,
  themeId: string,
  tx: StoreTx | null = null,
): Promise<ImportedTheme | null> {
  const info = await cachedForStore(storeId, `theme-import|${themeId}`, () =>
    within(storeId, tx, async (t) => {
      const record = await themeImportFor(t, themeId)
      return record
        ? {
            version: record.updatedAt.toISOString(),
            shopifyHost: record.themeInfo.shopifyHost ?? null,
          }
        : null
    }),
  )
  if (!info) return null
  // Previewing this theme (Edit code → Preview) shows its unpublished saves.
  const preview = readPreview(storeId, (await headers()).get('x-theme-preview'))
  const draft =
    preview?.themeId === themeId
      ? await within(storeId, tx, (t) => loadThemeDraftBundle(t, themeId))
      : null
  const bundle =
    draft ??
    peekThemeBundle(themeId, info.version) ??
    (await within(storeId, tx, (t) => loadThemeBundle(t, themeId)))
  return bundle ? { bundle, shopifyHost: info.shopifyHost } : null
}

/** One page context for `tx`, its theme data read through the store cache. */
async function createLiquidContext(
  tx: StoreTx,
  storeId: string,
  themeId: string,
  theme: ImportedTheme,
  scope: RequestScope,
  cart: LiquidCartData,
  nonce: string,
): Promise<LiquidPageContext> {
  const host = new URL(scope.origin).host
  const data = await storeLiquidData(tx, {
    storeId,
    host,
    origin: scope.origin,
    cart: async () => cart,
    reviews: await reviewsLiquidSource(tx, storeId),
  })
  return createPageContext({
    bundle: theme.bundle,
    data: cachedLiquidData(storeId, scope.origin, data),
    request: {
      template: scope.template,
      path: scope.path,
      host,
      origin: scope.origin,
      designMode: false,
      postedForm: scope.postedForm,
      listing: listingQuery(scope.listing),
      formsAvailable: await cachedForStore(storeId, 'forms-installed', () =>
        formsInstalled(tx, storeId),
      ),
      nonce,
    },
    assetBase: `/theme-assets/${themeId}`,
    shopifyHost: theme.shopifyHost,
    moneyFormat: null,
    paymentTypes: PAYMENT_TYPES,
  })
}

/**
 * A context whose renders are traced (cart and clock reads, failures), written with the nonce
 * placeholder so its output can be cached. `start()` begins a new trace for the next render.
 */
async function tracedContext(
  tx: StoreTx,
  storeId: string,
  themeId: string,
  theme: ImportedTheme,
  scope: RequestScope,
  cart: LiquidCartData,
) {
  let current = newTrace()
  const ctx = await createLiquidContext(tx, storeId, themeId, theme, scope, cart, NONCE_MARK)
  ctx.globals.cart = traceCartReads(ctx.globals.cart as object, () => current)
  ctx.runtime.onClock = () => {
    current.clock = true
  }
  return {
    ctx,
    start: (): RenderTrace => {
      current = newTrace()
      return current
    },
  }
}

/**
 * The Liquid context for this request when `themeId` is an imported theme, else null, for the
 * section rendering endpoints (`theme-actions`). Not cached: they change its globals. Runs in
 * the caller's transaction.
 */
export async function liquidContextFor(
  tx: StoreTx,
  storeId: string,
  themeId: string,
): Promise<LiquidPageContext | null> {
  const theme = await importedTheme(storeId, themeId, tx)
  if (!theme) return null
  const scope = await requestScope(storeId)
  const cartId = await readCartId()
  const cart = cartId ? await getCart({ storeId, tx }, cartId) : null
  return createLiquidContext(tx, storeId, themeId, theme, scope, toLiquidCart(cart), scope.nonce)
}

/** Template key → the location Liquid sees (`section.location`). */
const LOCATION: Record<string, string> = { header: 'header-group', footer: 'footer-group' }

export type LiquidSectionHtml = { html: string; tag: string; id: string; className: string }

/** What the cache keys a render by, or null when nothing may be cached (a theme preview). */
function cacheScope(
  scope: RequestScope,
  themeId: string,
  bundle: ThemeBundle,
): LiquidRenderScope | null {
  if (scope.preview) return null
  return {
    themeId,
    themeVersion: bundle.version,
    origin: scope.origin,
    // A filtered listing is its own page.
    path: scope.listing ? `${scope.path}?${scope.listing}` : scope.path,
    template: scope.template,
    postedForm: scope.postedForm,
  }
}

/** Which of a template's sections one call renders, and where the fold is. */
export type LiquidPart = {
  /** Top-level positions in the template's content this call renders: `start` up to `end`. */
  start: number
  end: number
  /** Sections at this position or later are below the fold (`liquid-fold.ts`). */
  fold: number
}

/** Every section, none below the fold (header and footer groups, theme previews). */
export const WHOLE_TEMPLATE: LiquidPart = { start: 0, end: Infinity, fold: Infinity }

/**
 * The `LiquidSection`s of a template within `part`, keyed by Puck id: from the cache, or
 * rendered now (all the missing ones in one transaction). Null when `themeId` is not an
 * imported theme.
 */
export async function renderLiquidSections(
  storeId: string,
  themeId: string,
  key: string,
  content: { type: string; props: Record<string, unknown> }[],
  part: LiquidPart = WHOLE_TEMPLATE,
): Promise<Map<string, LiquidSectionHtml> | null> {
  const theme = await importedTheme(storeId, themeId)
  if (!theme) return null
  // Placement counts every Liquid section of the template (`section.index`), drawn or not.
  const liquidItems = content
    .flatMap((item, position) => (item.type === 'LiquidSection' ? [{ item, position }] : []))
    .map((entry, index) => ({ ...entry, index }))
  const inPart = liquidItems.filter(({ position }) => position >= part.start && position < part.end)
  if (inPart.length === 0) return new Map()
  const scope = await requestScope(storeId)
  const cacheKey = cacheScope(scope, themeId, theme.bundle)
  const location = LOCATION[key] ?? 'template'
  const placed = inPart.map(({ item, position, index }) => {
    const type = typeof item.props.sectionType === 'string' ? item.props.sectionType : ''
    const schema = theme.bundle.sections.get(type)?.schema ?? null
    const section = liquidPlacement(item.props, schema, location, index)
    const belowFold = position >= part.fold
    return {
      id: String(item.props.id),
      type,
      section,
      belowFold,
      wrapper: sectionWrapper(theme.bundle, section),
      key: cacheKey ? sectionCacheKey(cacheKey, { section, belowFold }) : null,
    }
  })

  const out = new Map<string, LiquidSectionHtml>()
  const missing: typeof placed = []
  for (const p of placed) {
    const hit = p.key ? await peekForStore<CachedLiquid>(storeId, p.key) : undefined
    if (hit && (await servable(hit, () => cartIsEmpty(storeId)))) {
      out.set(p.id, { html: withNonce(hit.html, scope.nonce), ...p.wrapper })
    } else missing.push(p)
  }
  if (missing.length === 0) return out

  // The cart is read before the transaction: a second connection taken inside one could wait
  // on a pool that busy requests have filled.
  const cart = toLiquidCart(await requestCart(storeId))
  const rendered = await inStore(storeId, async (tx) => {
    const live = await tracedContext(tx, storeId, themeId, theme, scope, cart)
    const done: { p: (typeof placed)[number]; html: string; trace: RenderTrace }[] = []
    for (const p of missing) {
      const trace = live.start()
      const html = await renderLiquidSection(live.ctx, p.section, (err) => {
        trace.failed = true
        logger.error('liquid section failed to render', { storeId, section: p.type, error: err })
      })
      if (live.ctx.cache.missing) trace.failed = true
      // The theme's own `<script>` tags carry the nonce (written at parse time,
      // `nonceThemeScripts` in core); a script that came in with data never does. Its deferred
      // and module scripts wait for React (`./liquid-defer.ts`).
      const parked = deferThemeScripts(html)
      done.push({ p, html: p.belowFold ? belowTheFold(parked) : parked, trace })
    }
    return done
  })
  for (const { p, html, trace } of rendered) {
    out.set(p.id, { html: withNonce(html, scope.nonce), ...p.wrapper })
    if (p.key && keepable(trace, cart.itemCount === 0)) {
      const entry: CachedLiquid = { html, cart: trace.cart }
      await rememberForStore(storeId, p.key, entry, {
        size: html.length,
        ttlMs: renderTtl(trace, CACHE_TTL_MS),
      })
    }
  }
  return out
}

export type LiquidLayout = Awaited<ReturnType<typeof renderLiquidLayout>> & {
  fontsHref: string | null
}

type CachedLayout = { layout: LiquidLayout; cart: boolean }

/** `withNonce` over every HTML part of a layout. */
function layoutWithNonce(layout: LiquidLayout, nonce: string): LiquidLayout {
  return {
    ...layout,
    head: withNonce(layout.head, nonce),
    beforeHeader: withNonce(layout.beforeHeader, nonce),
    afterFooter: withNonce(layout.afterFooter, nonce),
  }
}

/**
 * The parts of the theme's `layout/theme.liquid` the store layout draws around `<main>`, for
 * `themeId` (the verified preview's, else the live one). Null for our own themes.
 */
export async function liquidLayoutFor(
  storeId: string,
  themeId: string,
): Promise<LiquidLayout | null> {
  const theme = await importedTheme(storeId, themeId)
  if (!theme) return null
  const scope = await requestScope(storeId)
  const cacheKey = cacheScope(scope, themeId, theme.bundle)
  const key = cacheKey ? layoutCacheKey(cacheKey) : null
  const hit = key ? await peekForStore<CachedLayout>(storeId, key) : undefined
  if (hit && (await servable(hit, () => cartIsEmpty(storeId)))) {
    return layoutWithNonce(hit.layout, scope.nonce)
  }

  const cart = toLiquidCart(await requestCart(storeId))
  const { layout, trace } = await inStore(storeId, async (tx) => {
    const live = await tracedContext(tx, storeId, themeId, theme, scope, cart)
    const trace = live.start()
    const parts = await renderLiquidLayout(live.ctx, (err) => {
      trace.failed = true
      logger.error('liquid layout failed to render', { storeId, error: err })
    })
    if (live.ctx.cache.missing) trace.failed = true
    const layout: LiquidLayout = {
      ...parts,
      head: deferThemeScripts(parts.head),
      beforeHeader: deferThemeScripts(parts.beforeHeader),
      afterFooter: deferThemeScripts(parts.afterFooter),
      fontsHref: googleFontsHref(parts.fonts),
    }
    return { layout, trace }
  })
  if (key && keepable(trace, cart.itemCount === 0)) {
    const entry: CachedLayout = { layout, cart: trace.cart }
    await rememberForStore(storeId, key, entry, {
      size: layout.head.length + layout.beforeHeader.length + layout.afterFooter.length,
      ttlMs: renderTtl(trace, CACHE_TTL_MS),
    })
  }
  return layoutWithNonce(layout, scope.nonce)
}

/** The theme this request renders: the verified preview's, else the live one. */
export async function requestThemeId(tx: StoreTx, storeId: string): Promise<string | null> {
  const preview = readPreview(storeId, (await headers()).get('x-theme-preview'))
  return preview?.themeId ?? (await mainThemeId(tx))
}

/**
 * Our answer to Shopify's section rendering (`/collections/x?section_id=tab-panel-cards`):
 * the theme's own section rendered with the collection or product of `path` in scope,
 * inside Shopify's wrapper. Theme JS uses it to fill lazy tabs and carousels.
 */
export async function renderStaticLiquidSection(
  tx: StoreTx,
  storeId: string,
  sectionType: string,
  path: string,
  prepare?: (ctx: LiquidPageContext) => Promise<void>,
): Promise<string | null> {
  const themeId = await requestThemeId(tx, storeId)
  const ctx = themeId ? await liquidContextFor(tx, storeId, themeId) : null
  if (!themeId || !ctx) return null
  // Shopify's section ids read `template--123__<key>`; the key is the section's type for
  // the sections a theme ships by default.
  const key = sectionType.split('__').pop() ?? sectionType
  const type = [sectionType, key].find((t) => ctx.bundle.sections.has(t))
  // A JSON template's key is not always its type (`"related": { "type": "related-products" }`):
  // the section placed under that key in the path's template, with its own settings.
  const placed = type ? null : await placedSection(tx, themeId, ctx.bundle, path, key)
  if (!type && !placed) return null
  const collection = /^\/collections\/([^/]+)/.exec(path)?.[1]
  const product = /^\/products\/([^/]+)/.exec(path)?.[1]
  if (collection) {
    const found = await ctx.options.data.collection(decodedSegment(collection))
    if (found) ctx.globals.collection = new CollectionDrop(found, ctx.cache)
  }
  if (product) {
    const found = await ctx.options.data.product(decodedSegment(product))
    if (found) ctx.globals.product = new ProductDrop(found, ctx.cache)
  }
  await prepare?.(ctx)
  const section: LiquidSectionInput = placed ?? {
    id: type ?? key,
    type: type ?? key,
    settings: {},
    blocks: [],
    location: 'template',
    index: 0,
  }
  const html = await renderLiquidSection(ctx, section)
  const w = sectionWrapper(ctx.bundle, section)
  return `<${w.tag} id="${w.id}" class="${w.className}">${html}</${w.tag}>`
}

/** The template a storefront path renders (`/products/x` → `product`). */
function templateKeyFor(path: string): TemplateKey {
  const name = liquidTemplateFor(path)
  if (name === 'index') return 'home'
  if (name === '404' || name === 'list-collections' || name === 'customers/account')
    return 'not_found'
  return name as TemplateKey
}

/**
 * The Liquid section placed under `key` in the template of `path` (Shopify's section ids end
 * in the template key), as the page itself renders it; null when that template has none.
 */
async function placedSection(
  tx: StoreTx,
  themeId: string,
  bundle: ThemeBundle,
  path: string,
  key: string,
): Promise<LiquidSectionInput | null> {
  const { data } = await loadTemplate(tx, themeId, templateKeyFor(path))
  const liquid = data.content.filter((item) => item.type === 'LiquidSection')
  const index = liquid.findIndex((item) => liquidSectionKey(item.props) === key)
  const item = liquid[index]
  const type = typeof item?.props.sectionType === 'string' ? item.props.sectionType : ''
  if (!item || !bundle.sections.has(type)) return null
  return liquidPlacement(item.props, bundle.sections.get(type)?.schema, 'template', index)
}

/**
 * Our answer to Shopify's `/recommendations/products?product_id=&limit=&section_id=&intent=`:
 * the theme's own section rendered on the product's page with `recommendations` filled. For
 * `related`, the merchant's Search & Discovery picks, then shared collection, type and tags; for
 * `complementary`, the picks only. Published and in stock only. Null when the section is not in
 * the theme, or the product is not ours.
 */
export async function renderRecommendations(
  tx: StoreTx,
  storeId: string,
  input: { sectionId: string; productId: string; limit: number; intent: RecommendationIntent },
): Promise<string | null> {
  const productId = await resolveThemeProductId(tx, input.productId)
  if (!productId) return null
  const [row] = await tx
    .select({ handle: productTable.handle })
    .from(productTable)
    .where(eq(productTable.id, productId))
  if (!row) return null
  const path = `/products/${encodeURIComponent(row.handle)}`
  return renderStaticLiquidSection(tx, storeId, input.sectionId, path, async (ctx) => {
    const related = await ctx.options.data.relatedProducts(productId, input.limit, input.intent)
    ctx.globals.recommendations = {
      performed: true,
      intent: input.intent,
      products: related.map((p) => new ProductDrop(p, ctx.cache)),
      products_count: related.length,
    }
  })
}

/** A path segment decoded, or as it came when it is not valid percent-encoding (never a 500). */
function decodedSegment(segment: string): string {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

/** Theme layout attributes (`class`, `data-*`, `lang`) as React props; handlers and styles dropped. */
export function reactAttrs(attrs: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(attrs)) {
    if (k.startsWith('on') || k === 'style') continue
    out[k === 'class' ? 'className' : k === 'tabindex' ? 'tabIndex' : k] = v
  }
  return out
}
