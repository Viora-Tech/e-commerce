import { loadEnv } from '@commerce/config'
import { permissions } from '@commerce/core'
import { searchConsoleOAuthApp } from '@commerce/plugin-search-console/google'
import { z } from 'zod'
import { can } from '../procedures'
import {
  chooseSearchConsoleProperty,
  completeSearchConsoleConnect,
  disconnectSearchConsole,
  getSearchConsoleView,
  listSearchConsoleProperties,
  refreshSearchConsole,
  type SearchConsoleEnv,
  searchConsoleSitemaps,
  startSearchConsoleConnect,
  submitSearchConsoleSitemap,
} from '../services/search-console.service'
import { productSearchCard, searchConsoleReport } from '../services/search-console-report.service'

/** The Search Console OAuth client and URLs; the Growth card reads it too. */
export function searchConsoleEnv(): SearchConsoleEnv {
  const env = loadEnv(process.env)
  return {
    secret: env.SETTINGS_SECRET,
    adminUrl: env.ADMIN_URL,
    storefrontUrl: env.STOREFRONT_URL,
    app: searchConsoleOAuthApp(process.env),
  }
}

/**
 * The Google Search Console app. Reading its numbers is `online_store.read`; connecting,
 * disconnecting and picking the property are `settings.manage`; "Refresh now" and submitting
 * the sitemap are `online_store.write`.
 */
export const searchConsoleRouter = {
  /** Connection state for the app's pages: account, property, last sync, refresh cooldown. */
  view: can(permissions.ONLINE_STORE_READ).handler(({ context }) =>
    getSearchConsoleView(context.tx, context.scope.storeId, searchConsoleEnv()),
  ),
  /** Where "Connect Google Search Console" sends the merchant. */
  connectStart: can(permissions.SETTINGS_MANAGE).handler(({ context }) =>
    startSearchConsoleConnect(context.tx, context.scope.storeId, searchConsoleEnv()),
  ),
  /** The OAuth callback route hands the code here; the state must be this store's, and fresh. */
  connectComplete: can(permissions.SETTINGS_MANAGE)
    .input(z.object({ code: z.string().min(1).max(2000), state: z.string().min(1).max(2000) }))
    .handler(({ context, input }) =>
      completeSearchConsoleConnect(context.tx, context.scope.storeId, searchConsoleEnv(), input),
    ),
  disconnect: can(permissions.SETTINGS_MANAGE).handler(({ context }) =>
    disconnectSearchConsole(context.tx, context.scope.storeId, searchConsoleEnv()),
  ),
  /** The connected account's properties and the one that matches the store's domain. */
  properties: can(permissions.SETTINGS_MANAGE).handler(({ context }) =>
    listSearchConsoleProperties(context.tx, context.scope.storeId, searchConsoleEnv()),
  ),
  chooseProperty: can(permissions.SETTINGS_MANAGE)
    .input(z.object({ property: z.string().trim().min(1).max(500) }))
    .handler(({ context, input }) =>
      chooseSearchConsoleProperty(
        context.tx,
        context.scope.storeId,
        searchConsoleEnv(),
        input.property,
      ),
    ),
  /** Pulls fresh numbers from Google now; rate limited (the worker also syncs daily). */
  refresh: can(permissions.ONLINE_STORE_WRITE).handler(({ context }) =>
    refreshSearchConsole(context.tx, context.scope.storeId, searchConsoleEnv()),
  ),
  /** Totals, searches, pages and the opportunity lists, from the stored numbers. */
  report: can(permissions.ONLINE_STORE_READ).handler(({ context }) =>
    searchConsoleReport(context.tx, context.scope.storeId, searchConsoleEnv()),
  ),
  sitemaps: can(permissions.ONLINE_STORE_READ).handler(({ context }) =>
    searchConsoleSitemaps(context.tx, context.scope.storeId, searchConsoleEnv()),
  ),
  submitSitemap: can(permissions.ONLINE_STORE_WRITE).handler(({ context }) =>
    submitSearchConsoleSitemap(context.tx, context.scope.storeId, searchConsoleEnv()),
  ),
  /** The product page's "Google search" card. */
  product: can(permissions.ONLINE_STORE_READ)
    .input(z.object({ productId: z.uuid() }))
    .handler(({ context, input }) =>
      productSearchCard(context.tx, context.scope.storeId, input.productId),
    ),
}
