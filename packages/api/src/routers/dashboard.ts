import { dismissHomeCard, listHomeCards, permissions } from '@commerce/core'
import { HOME_METRICS, HOME_TILE_COUNT } from '@commerce/core/home-metrics'
import { z } from 'zod'
import { can, storeProcedure } from '../procedures'
import { dashboardCharts, dashboardSummary } from '../services/dashboard.service'
import { homeAnalytics, loadHomeTiles, saveHomeTiles } from '../services/home-analytics.service'

/** The Live view globe's "Time range" setting: how far back `mapOrders` looks. */
const GlobeMapRangeSchema = z.enum(['1h', '24h', '7d'])

export const dashboardRouter = {
  /** Stat windows, weekly report, recent orders, top products, live visitors and quick lists for the home page. */
  summary: can(permissions.ANALYTICS_READ)
    .input(
      z
        .object({ mapRange: GlobeMapRangeSchema.default('24h') })
        .default(() => ({ mapRange: '24h' as const })),
    )
    .handler(({ context, input }) =>
      dashboardSummary(context.tx, {
        storeId: context.scope.storeId,
        visitors: context.visitors,
        mapRange: input.mapRange,
      }),
    ),

  /** The "How you're doing" charts area for one range; the only part of the home page that refetches. */
  charts: can(permissions.ANALYTICS_READ)
    .input(z.object({ range: z.union([z.literal(7), z.literal(30), z.literal(90)]).default(30) }))
    .handler(({ context, input }) =>
      dashboardCharts(context.tx, {
        storeId: context.scope.storeId,
        range: input.range,
        visitors: context.visitors,
      }),
    ),

  /** Home's analytics card for any date range (Figma 580:692): every tile metric, with comparison. */
  analytics: can(permissions.ANALYTICS_READ)
    .input(
      z.object({
        from: z.iso.date(),
        to: z.iso.date(),
        compare: z.enum(['previous', 'year', 'none']).default('previous'),
      }),
    )
    .handler(({ context, input }) =>
      homeAnalytics(context.tx, {
        ...input,
        storeId: context.scope.storeId,
        visitors: context.visitors,
      }),
    ),

  /** Which metric this member keeps in each Home tile (Customize). Any member may set their own. */
  tiles: storeProcedure.handler(({ context }) =>
    loadHomeTiles(context.tx, context.scope.storeId, context.scope.userId),
  ),

  setTiles: storeProcedure
    .input(z.object({ tiles: z.array(z.enum(HOME_METRICS)).length(HOME_TILE_COUNT) }))
    .handler(({ context, input }) =>
      saveHomeTiles(context.tx, context.scope.storeId, context.scope.userId, input.tiles),
    ),

  /** Home's smart cards: suggestions from the store's own numbers, rebuilt daily, best first. */
  cards: can(permissions.ANALYTICS_READ).handler(({ context }) =>
    listHomeCards({ storeId: context.scope.storeId, tx: context.tx }),
  ),

  /** Hide one smart card for 30 days for the whole store; `dismissed: false` is Undo. */
  dismissCard: can(permissions.ANALYTICS_READ)
    .input(z.object({ key: z.string().min(1).max(200), dismissed: z.boolean().default(true) }))
    .handler(({ context, input }) =>
      dismissHomeCard(
        { storeId: context.scope.storeId, tx: context.tx },
        input.key,
        input.dismissed,
      ),
    ),
}
