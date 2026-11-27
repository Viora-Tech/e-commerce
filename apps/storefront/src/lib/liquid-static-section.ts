import 'server-only'
import {
  CollectionDrop,
  type LiquidPageContext,
  type LiquidSectionInput,
  liquidPlacement,
  liquidSectionKey,
  loadTemplate,
  mainThemeId,
  ProductDrop,
  type RecommendationIntent,
  renderLiquidSection,
  resolveThemeProductId,
  sectionWrapper,
  type TemplateKey,
  type ThemeBundle,
} from '@commerce/core'
import { product as productTable, type StoreTx } from '@commerce/db'
import { eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { liquidContextFor } from './liquid-context'
import { withMarketPrefix } from './liquid-market-links'
import { liquidTemplateFor, requestScope } from './liquid-scope'
import { abThemeId } from './rollout-ab'
import { readPreview } from './storefront-gate'

/**
 * Our answers to Shopify's section rendering and product recommendations endpoints: one theme
 * section rendered outside a page (`?section_id=`, `/recommendations/products`), with the
 * path's collection or product in scope. Split from liquid-theme.ts.
 */

/**
 * The theme this request renders: the verified preview's, else an A/B rollout's Treatment theme
 * for a visitor in that arm, else the live one.
 */
export async function requestThemeId(tx: StoreTx, storeId: string): Promise<string | null> {
  const preview = readPreview(storeId, (await headers()).get('x-theme-preview'))
  return preview?.themeId ?? (await abThemeId(storeId)) ?? (await mainThemeId(tx))
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
  const ctx = themeId ? await liquidContextFor(tx, storeId, themeId, path) : null
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
    if (found) {
      const drop = new CollectionDrop(found, ctx.cache)
      // As on the page itself: the request's filters, sort and page shape its products.
      if (ctx.options.request.listing) drop.listOn(ctx.options.request.listing)
      ctx.globals.collection = drop
    }
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
  const html = withMarketPrefix(
    await renderLiquidSection(ctx, section),
    (await requestScope(storeId)).market.market?.prefix ?? '',
  )
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
