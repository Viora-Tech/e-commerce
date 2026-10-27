import 'server-only'
import { searchCollections, suggestProducts } from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import { listCardProducts } from './catalog'
import type { PredictiveParams, PredictiveResults } from './predictive-json'
import './search-engine'

/**
 * Shopify's Predictive Search for an imported theme's header (`/search/suggest.json`, and the
 * `predictive-search` section through `/search/suggest?section_id=`): the store's best product
 * matches (the same search as the search page) and the collections whose titles hold every
 * word; `predictive-json.ts` puts them in the shape Shopify answers, so the theme's own script
 * draws them unchanged.
 */

/** The products and collections a predictive search shows, inside the store's transaction. */
export async function predictiveResults(
  tx: StoreTx,
  storeId: string,
  p: PredictiveParams,
): Promise<PredictiveResults> {
  if (p.q.length < 2) return { terms: p.q, products: [], collections: [] }
  const handles = p.products ? await suggestProducts(tx, p.q, p.limit, storeId, p.unavailable) : []
  const products = handles.length
    ? await listCardProducts(tx, handles.length, undefined, handles)
    : []
  const collections = p.collections ? await searchCollections(tx, p.q, p.limit) : []
  return { terms: p.q, products, collections }
}
