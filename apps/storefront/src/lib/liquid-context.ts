import 'server-only'
import {
  createPageContext,
  getCart,
  type LiquidCartData,
  type LiquidPageContext,
  loadThemeBundle,
  loadThemeDraftBundle,
  peekThemeBundle,
  type SignedInCustomer,
  storeLiquidData,
  type ThemeBundle,
  themeImportFor,
} from '@commerce/core'
import { type StoreTx, store } from '@commerce/db'
import { reviewsLiquidSource } from '@commerce/plugin-reviews/server'
import { eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { readCartId } from './cart-cookie'
import { customerIn } from './customer-session'
import { formsInstalled } from './forms-context'
import { NONCE_MARK, newTrace, type RenderTrace, traceContextReads } from './liquid-cache'
import { toLiquidCart } from './liquid-cart'
import { cachedLiquidData } from './liquid-data-cache'
import { listingQuery, marketKey, type RequestScope, requestScope, scopeAt } from './liquid-scope'
import './search-engine'
import { cachedForStore } from './store-cache'
import { inStore } from './store-context'
import { readPreview } from './storefront-gate'

/**
 * An imported theme's bundle and the Liquid page context its renders run in (`liquid-theme.ts`,
 * `liquid-cards.ts`, the section rendering endpoints): theme data read through the store cache,
 * with the request's template, market and listing. Split from liquid-theme.ts.
 */

/** Payment marks the theme's footer draws, from the methods this store offers. */
const PAYMENT_TYPES = ['upi', 'visa', 'master', 'rupay', 'american_express']

export type ImportedTheme = { bundle: ThemeBundle; shopifyHost: string | null }

/** Runs `read` in `tx` when the caller holds one, else in a transaction of its own. */
function within<T>(storeId: string, tx: StoreTx | null, read: (tx: StoreTx) => Promise<T>) {
  return tx ? read(tx) : inStore(storeId, read)
}

/**
 * An imported theme's bundle, or null for one of our own themes. The import row's version is
 * cached per store version; the bundle itself is built once per theme version (core keeps it).
 * Pass `tx` when the caller already holds a transaction, so no second connection is taken.
 */
export async function importedTheme(
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
  customer: SignedInCustomer | null,
  nonce: string,
): Promise<LiquidPageContext> {
  const host = new URL(scope.origin).host
  const data = await storeLiquidData(tx, {
    storeId,
    host,
    origin: scope.origin,
    cart: async () => cart,
    customer,
    reviews: await reviewsLiquidSource(tx, storeId),
    pricing: scope.pricing,
  })
  return createPageContext({
    bundle: theme.bundle,
    data: cachedLiquidData(storeId, scope.origin, data, marketKey(scope)),
    request: {
      template: scope.template,
      path: scope.path,
      host,
      origin: scope.origin,
      marketPrefix: scope.market.market?.prefix ?? '',
      designMode: false,
      postedForm: scope.postedForm,
      listing: listingQuery(scope.listing),
      formsAvailable: await cachedForStore(storeId, 'forms-installed', () =>
        formsInstalled(tx, storeId),
      ),
      nonce,
      experiments: scope.experiments,
      market: scope.market.market,
    },
    assetBase: `/theme-assets/${themeId}`,
    shopifyHost: theme.shopifyHost,
    // The store's price format (`Rs. {{amount}}` from Shopify), for `| money` and `shop.money_format`.
    moneyFormat: await cachedForStore(storeId, 'money-format', async () => {
      const [s] = await tx
        .select({ moneyFormat: store.moneyFormat })
        .from(store)
        .where(eq(store.id, storeId))
      return s?.moneyFormat ?? null
    }),
    paymentTypes: PAYMENT_TYPES,
  })
}

/**
 * A context whose renders are traced (cart, customer and clock reads, failures), written with
 * the nonce placeholder so its output can be cached. `start()` begins a new trace for the next
 * render.
 */
export async function tracedContext(
  tx: StoreTx,
  storeId: string,
  themeId: string,
  theme: ImportedTheme,
  scope: RequestScope,
  cart: LiquidCartData,
  customer: SignedInCustomer | null,
) {
  let current = newTrace()
  const ctx = await createLiquidContext(
    tx,
    storeId,
    themeId,
    theme,
    scope,
    cart,
    customer,
    NONCE_MARK,
  )
  traceContextReads(ctx, () => current)
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
  pagePath?: string,
): Promise<LiquidPageContext | null> {
  const theme = await importedTheme(storeId, themeId, tx)
  if (!theme) return null
  const request = await requestScope(storeId)
  const scope = pagePath ? await scopeAt(request, pagePath) : request
  const cartId = await readCartId()
  const cart = cartId ? await getCart({ storeId, tx }, cartId) : null
  return createLiquidContext(
    tx,
    storeId,
    themeId,
    theme,
    scope,
    toLiquidCart(cart, scope.pricing),
    await customerIn(tx, storeId),
    scope.nonce,
  )
}
