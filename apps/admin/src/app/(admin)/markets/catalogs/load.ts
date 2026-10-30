import { appRouter, call, type serverContext } from '@/lib/api'

type Context = Awaited<ReturnType<typeof serverContext>>

/** What the catalog page picks from: the store's markets and every catalog (to name a market's). */
export async function loadCatalogPage(context: Context) {
  const [markets, catalogs] = await Promise.all([
    call(appRouter.markets.list, undefined, { context }),
    call(appRouter.catalogs.list, undefined, { context }),
  ])
  return { markets, catalogs }
}
