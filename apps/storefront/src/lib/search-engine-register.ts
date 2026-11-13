import { loadEnv } from '@commerce/config'
import {
  type ProductSearchEngine,
  productSearchEngine,
  setProductSearchEngine,
} from '@commerce/core'
import { meiliEnv, meilisearchEngine } from '@commerce/plugin-meilisearch/server'

/**
 * Registers the Meilisearch app as the product search engine (`setProductSearchEngine`), so
 * `browseProducts` and `suggestProducts` ask a store's Meilisearch first when the store has the
 * app connected and indexed, and fall back to SQL otherwise (a per-store choice, made on each
 * search from the store's own settings and the engine's health).
 *
 * The process-wide choice is made once, at boot (`instrumentation.ts`), so every page and route
 * sees the same engine whatever module loaded first. Later calls change nothing: the first
 * registration in the process wins. The environment is read on the first search, not here
 * (builds have no secrets). No `server-only` here: instrumentation imports it.
 */
export function registerSearchEngine(): void {
  if (productSearchEngine()) return
  let engine: ProductSearchEngine | null = null
  setProductSearchEngine((input) => {
    if (!engine) {
      const env = loadEnv(process.env)
      engine = meilisearchEngine(meiliEnv(env.SETTINGS_SECRET, env.MEILISEARCH_TRUSTED_ORIGINS))
    }
    return engine(input)
  })
}
