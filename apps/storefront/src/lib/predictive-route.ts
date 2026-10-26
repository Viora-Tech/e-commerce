import 'server-only'
import { CollectionDrop, ProductDrop } from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import { renderStaticLiquidSection } from './liquid-theme'
import { predictiveJson, predictiveParams } from './predictive-json'
import { predictiveResults } from './predictive-search'
import { clientIp, rateLimited, retryAfterSeconds } from './rate-limit'
import { inStore } from './store-context'

/** Generous: this is autocomplete-as-you-type, so a real shopper fires it often (as `/api/search/suggest`). */
const SUGGEST_IP_RULE = { limit: 60, windowMs: 60_000 }

const CACHE = 'public, max-age=30, stale-while-revalidate=60'

/**
 * The theme's predictive search section (`/search/suggest?section_id=predictive-search`) with
 * Shopify's `predictive_search` filled from our search: products in rank order, collections.
 * Null when the theme has no such section.
 */
async function renderPredictiveSearch(
  tx: StoreTx,
  storeId: string,
  input: {
    sectionId: string
    terms: string
    handles: string[]
    collectionHandles: string[]
    query: { text: string; styled_text: string; url: string } | null
  },
): Promise<string | null> {
  return renderStaticLiquidSection(tx, storeId, input.sectionId, '/search', async (ctx) => {
    const data = ctx.options.data
    const byHandle = data.products
      ? await data.products(input.handles)
      : new Map(
          (await Promise.all(input.handles.map((h) => data.product(h)))).flatMap((p) =>
            p ? [[p.handle, p] as const] : [],
          ),
        )
    const products = input.handles.flatMap((h) => {
      const p = byHandle.get(h)
      return p ? [new ProductDrop(p, ctx.cache)] : []
    })
    const collections = (
      await Promise.all(input.collectionHandles.map((h) => data.collection(h)))
    ).flatMap((c) => (c ? [new CollectionDrop(c, ctx.cache)] : []))
    const queries = input.query ? [input.query] : []
    ctx.globals.predictive_search = {
      performed: true,
      terms: input.terms,
      resources: { products, collections, pages: [], articles: [], queries },
    }
  })
}

/**
 * Shopify's predictive search endpoints on a store's own domain, for an imported theme's
 * header: `/search/suggest.json` answers JSON; `/search/suggest?section_id=<id>` answers that
 * theme section rendered with `predictive_search` (Dawn-style themes), and JSON without one.
 * A locked store never gets here: the proxy serves the password page instead.
 */
export async function predictiveResponse(
  request: Request,
  storeId: string,
  json: boolean,
): Promise<Response> {
  const ip = clientIp(request.headers)
  const limit = await rateLimited('search-suggest:ip', ip, SUGGEST_IP_RULE)
  if (!limit.ok) {
    return Response.json(
      { error: 'Too many requests. Please slow down.' },
      { status: 429, headers: { 'retry-after': String(retryAfterSeconds(limit)) } },
    )
  }
  const url = new URL(request.url)
  const params = predictiveParams(url.searchParams)
  const sectionId = json ? '' : (url.searchParams.get('section_id') ?? '')
  if (sectionId && !/^[a-z0-9_-]{1,80}$/i.test(sectionId)) {
    return new Response('Not found', { status: 404 })
  }
  const out = await inStore(storeId, async (tx) => {
    const results = await predictiveResults(tx, storeId, params)
    if (!sectionId) return { results, html: null }
    const body = predictiveJson(results, params).resources.results
    const rendered = await renderPredictiveSearch(tx, storeId, {
      sectionId,
      terms: results.terms,
      handles: results.products.map((p) => p.handle),
      collectionHandles: results.collections.map((c) => c.handle),
      query: body.queries[0] ?? null,
    })
    return { results, html: rendered }
  })
  if (sectionId) {
    if (out.html === null) return new Response('Not found', { status: 404 })
    return new Response(out.html, {
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': CACHE },
    })
  }
  return Response.json(predictiveJson(out.results, params), {
    headers: { 'cache-control': CACHE },
  })
}
