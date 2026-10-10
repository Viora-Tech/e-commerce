import 'server-only'
import {
  CollectionDrop,
  createPageContext,
  getCart,
  googleFontsHref,
  type LiquidCartData,
  type LiquidPageContext,
  type LiquidSectionInput,
  liquidPlacement,
  loadThemeBundle,
  mainThemeId,
  ProductDrop,
  renderLiquidLayout,
  renderLiquidSection,
  resolveThemeProductId,
  sectionWrapper,
  storeLiquidData,
  themeImportFor,
} from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import { reviewsLiquidSource } from '@commerce/plugin-reviews/server'
import { headers } from 'next/headers'
import { readCartId } from './cart-cookie'
import { NONCE_HEADER } from './csp'
import { formsInstalled } from './forms-context'
import { deferThemeScripts } from './liquid-defer'
import { requestOrigin } from './seo'
import { readPreview } from './storefront-gate'

/**
 * The storefront side of imported Shopify themes (`@commerce/core` theme-import):
 * one Liquid page context per request, the section HTML the `LiquidSection`
 * renderer draws, and the layout parts (head, icon sprites, cart drawer, scripts)
 * the store layout puts around `<main>`.
 */

/** Payment marks the theme's footer draws, from the methods this store offers. */
const PAYMENT_TYPES = ['upi', 'visa', 'master', 'rupay', 'american_express']

async function cartFor(tx: StoreTx, storeId: string): Promise<LiquidCartData> {
  const cartId = await readCartId()
  const cart = cartId ? await getCart({ storeId, tx }, cartId) : null
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

/**
 * The Liquid context for this request when `themeId` is an imported theme, else
 * null. The template name comes from the path the proxy forwarded.
 */
export async function liquidContextFor(
  tx: StoreTx,
  storeId: string,
  themeId: string,
): Promise<LiquidPageContext | null> {
  const bundle = await loadThemeBundle(tx, themeId)
  if (!bundle) return null
  const record = await themeImportFor(tx, themeId)
  const origin = await requestOrigin()
  const h = await headers()
  const url = new URL(origin)
  const posted = h.get('x-form-posted')
  const path = h.get('x-pathname') ?? '/'
  const template = liquidTemplateFor(path)
  return createPageContext({
    bundle,
    data: await storeLiquidData(tx, {
      storeId,
      host: url.host,
      origin,
      cart: () => cartFor(tx, storeId),
      reviews: await reviewsLiquidSource(tx, storeId),
    }),
    request: {
      template,
      path,
      host: url.host,
      origin,
      designMode: false,
      postedForm: posted,
      formsAvailable: await formsInstalled(tx, storeId),
      nonce: h.get(NONCE_HEADER) ?? '',
    },
    assetBase: `/theme-assets/${themeId}`,
    shopifyHost: record?.themeInfo.shopifyHost ?? null,
    moneyFormat: null,
    paymentTypes: PAYMENT_TYPES,
  })
}

/** Template key → the location Liquid sees (`section.location`). */
const LOCATION: Record<string, string> = { header: 'header-group', footer: 'footer-group' }

/**
 * Renders every `LiquidSection` in a template now, while the store transaction is
 * open; the renderer later only places the HTML. Keyed by Puck id.
 */
export async function prerenderLiquidSections(
  ctx: LiquidPageContext,
  key: string,
  content: { type: string; props: Record<string, unknown> }[],
): Promise<Map<string, { html: string; tag: string; id: string; className: string }>> {
  const out = new Map<string, { html: string; tag: string; id: string; className: string }>()
  const location = LOCATION[key] ?? 'template'
  let index = 0
  for (const item of content) {
    if (item.type !== 'LiquidSection') continue
    const type = typeof item.props.sectionType === 'string' ? item.props.sectionType : ''
    const schema = ctx.bundle.sections.get(type)?.schema ?? null
    const section = liquidPlacement(item.props, schema, location, index++)
    const html = await renderLiquidSection(ctx, section, (err) =>
      console.error(`[liquid] ${type} failed to render`, err),
    )
    const wrapper = sectionWrapper(ctx.bundle, section)
    // The theme's own `<script>` tags already carry this request's nonce (written at parse
    // time, `nonceThemeScripts` in core); a script that came in with data never does. Its
    // deferred and module scripts wait for React (`./liquid-defer.ts`).
    out.set(String(item.props.id), { html: deferThemeScripts(html), ...wrapper })
  }
  return out
}

/** The parts of the theme's `layout/theme.liquid` the store layout draws around `<main>`. */
export async function liquidLayoutFor(ctx: LiquidPageContext) {
  const parts = await renderLiquidLayout(ctx, (err) => console.error('[liquid] layout failed', err))
  return {
    ...parts,
    head: deferThemeScripts(parts.head),
    beforeHeader: deferThemeScripts(parts.beforeHeader),
    afterFooter: deferThemeScripts(parts.afterFooter),
    fontsHref: googleFontsHref(parts.fonts),
  }
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
  if (!ctx) return null
  // Shopify's section ids read `template--123__<key>`; the key is the section's type for
  // the sections a theme ships by default.
  const key = sectionType.split('__').pop() ?? sectionType
  const type = [sectionType, key].find((t) => ctx.bundle.sections.has(t))
  if (!type) return null
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
  const section: LiquidSectionInput = {
    id: type,
    type,
    settings: {},
    blocks: [],
    location: 'template',
    index: 0,
  }
  const html = await renderLiquidSection(ctx, section)
  const w = sectionWrapper(ctx.bundle, section)
  return `<${w.tag} id="${w.id}" class="${w.className}">${html}</${w.tag}>`
}

/**
 * Our answer to Shopify's `/recommendations/products?product_id=&limit=&section_id=`: the
 * theme's own section rendered with `recommendations.products` filled from the product's
 * related products (shared collection, then type and tags; published and in stock only).
 * Null when the section is not in the theme, or the product is not ours.
 */
export async function renderRecommendations(
  tx: StoreTx,
  storeId: string,
  input: { sectionId: string; productId: string; limit: number },
): Promise<string | null> {
  const productId = await resolveThemeProductId(tx, input.productId)
  if (!productId) return null
  return renderStaticLiquidSection(tx, storeId, input.sectionId, '/', async (ctx) => {
    const related = await ctx.options.data.relatedProducts(productId, input.limit)
    ctx.globals.recommendations = {
      performed: true,
      intent: 'related',
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
