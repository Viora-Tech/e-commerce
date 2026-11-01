import { appRouter, call, type serverContext } from '@/lib/api'

type Context = Awaited<ReturnType<typeof serverContext>>

/**
 * What every market starts from, for the Graph view and the New market page. Each part is read
 * with its own permission; a member who cannot see one gets null and the card says less.
 */
export type StoreDefaults = {
  productCount: number | null
  discountCount: number | null
  legalName: string | null
  gstRatePercent: number | null
}

async function orNull<T>(read: Promise<T>): Promise<T | null> {
  try {
    return await read
  } catch {
    return null
  }
}

/** The Markets home and the New market page: markets, domains, catalogs and the store defaults. */
export async function loadMarketsHome(context: Context) {
  const [markets, domains, catalogs, products, discounts, taxes, settings] = await Promise.all([
    call(appRouter.markets.list, undefined, { context }),
    call(appRouter.domains.list, undefined, { context }),
    orNull(call(appRouter.catalogs.list, undefined, { context })),
    orNull(call(appRouter.products.stats, undefined, { context })),
    orNull(call(appRouter.discounts.stats, undefined, { context })),
    orNull(call(appRouter.taxes.get, undefined, { context })),
    orNull(call(appRouter.markets.settings, undefined, { context })),
  ])
  const defaults: StoreDefaults = {
    productCount: products ? Number(products.active) : null,
    discountCount: discounts ? Number(discounts.active) : null,
    legalName: taxes?.form.legalName.trim() || null,
    gstRatePercent: taxes ? Number(taxes.form.gstRatePercent) : null,
  }
  return {
    markets,
    domains,
    catalogs: catalogs ?? [],
    defaults,
    suggestMarket: settings?.suggestMarket ?? true,
  }
}
