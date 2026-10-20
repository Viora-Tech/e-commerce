import 'server-only'
import { loadEnv } from '@commerce/config'
import { type ProductSearchEngine, setProductSearchEngine } from '@commerce/core'
import { meiliEnv, meilisearchEngine } from '@commerce/plugin-meilisearch/server'

/**
 * Registers the Meilisearch app as the product search engine (`setProductSearchEngine`), so
 * `browseProducts` and `suggestProducts` ask a store's Meilisearch first when the store has the
 * app connected and indexed, and fall back to SQL otherwise. Imported for its effect by the
 * search page and the predictive search route; registering twice is harmless (the last wins).
 * The environment is read on the first search, not at import (builds have no secrets).
 */
let engine: ProductSearchEngine | null = null

setProductSearchEngine((input) => {
  if (!engine) {
    const env = loadEnv(process.env)
    engine = meilisearchEngine(meiliEnv(env.SETTINGS_SECRET, env.MEILISEARCH_TRUSTED_ORIGINS))
  }
  return engine(input)
})
