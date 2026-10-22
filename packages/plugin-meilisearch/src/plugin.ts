// The leaf module, not the barrel: @commerce/core's barrel loads the plugin registry, which
// loads this plugin, so importing the barrel here reads the name before it exists.
import { PRODUCTS_CHANGED_JOB } from '@commerce/core/outbox-types'
import { definePlugin } from '@commerce/plugins'
import { z } from 'zod'
import { meiliEnv, reindexStore, syncProducts } from './server'
import { MEILISEARCH_ID, parseMeilisearchSettings, REINDEX_JOB } from './settings'

const ChangedData = z.object({ productIds: z.array(z.string()).max(1000) })

/**
 * Meilisearch search. Shoppers' searches (the search page, the header's predictive search)
 * are matched and ranked by the store's Meilisearch server, typo-tolerant and with the
 * merchant's synonyms; products are then loaded from Postgres by id, so prices, stock and
 * visibility are always our own. When Meilisearch is down or slow (over 300 ms), the built-in
 * search answers instead. Settings live in `store.apps` (no table); both keys are encrypted
 * there. Meilisearch itself runs elsewhere (a self-hosted server or Meilisearch Cloud); no
 * Meilisearch code is bundled, its REST API is called with `fetch`.
 */
export const meilisearchPlugin = definePlugin({
  id: MEILISEARCH_ID,
  name: 'Meilisearch',
  version: '1.0.0',
  kind: 'connection',
  category: 'search',
  company: 'Meilisearch',
  description:
    'Fast search that forgives typos: shoppers find “tshirt”, “t-shrit” and “tee” alike. Add your own synonyms.',
  access: {
    resources: [
      { resource: 'products', level: 'read', why: 'Copies product titles and details into search' },
      {
        resource: 'collections',
        level: 'read',
        why: 'Lets search know which collections hold a product',
      },
    ],
    summary: 'powers search',
    shares: [
      {
        when: 'When a product is added or changed, and on Reindex now',
        what: 'Product title, handle, vendor, type, tags, SKUs, options, description, collections, prices and main photo address',
      },
      { when: 'Every storefront search', what: 'The words the shopper typed' },
    ],
  },
  setupState: (raw) => {
    const s = parseMeilisearchSettings(raw)
    return {
      connected: s.host !== '' && s.adminKey !== '' && s.lastSyncAt !== null,
      problem: s.adminKey !== '' ? s.lastError : null,
    }
  },
  provides: {},
  credits: [
    {
      name: 'Meilisearch',
      url: 'https://github.com/meilisearch/meilisearch',
      license: 'MIT',
      note: 'Search engine, run as a separate server and called over its REST API; community edition only',
    },
  ],
  jobs: {
    // "Reindex now" on the app page queues this; it rebuilds the index and swaps it in.
    [REINDEX_JOB]: async (ctx) => {
      const result = await reindexStore({
        storeId: ctx.storeId,
        inStore: ctx.inStore,
        env: meiliEnv(ctx.settingsSecret),
      })
      ctx.reportActivity?.(`Indexed ${result.documents} products for search`)
    },
    // The outbox relay queues this after products are created, edited or deleted.
    [PRODUCTS_CHANGED_JOB]: async (ctx, data) => {
      const parsed = ChangedData.safeParse(data)
      if (!parsed.success) return
      const result = await syncProducts({
        storeId: ctx.storeId,
        inStore: ctx.inStore,
        env: meiliEnv(ctx.settingsSecret),
        productIds: parsed.data.productIds,
      })
      if (result)
        ctx.reportActivity?.(`Updated ${result.upserted + result.deleted} products in search`)
    },
  },
  admin: {
    icon: 'Search',
    pages: [{ path: '', title: 'Search', navLabel: 'Search', icon: 'Search' }],
  },
})
