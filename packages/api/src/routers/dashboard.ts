import { permissions } from '@commerce/core'
import { z } from 'zod'
import { can } from '../procedures'
import { dashboardCharts, dashboardSummary } from '../services/dashboard.service'

export const dashboardRouter = {
  /** Stat windows, weekly report, recent orders, top products, live visitors and quick lists for the home page. */
  summary: can(permissions.ANALYTICS_READ).handler(({ context }) =>
    dashboardSummary(context.tx, {
      storeId: context.scope.storeId,
      visitors: context.visitors,
    }),
  ),

  /** The "How you're doing" charts area for one range; the only part of the home page that refetches. */
  charts: can(permissions.ANALYTICS_READ)
    .input(z.object({ range: z.union([z.literal(7), z.literal(30), z.literal(90)]).default(30) }))
    .handler(({ context, input }) =>
      dashboardCharts(context.tx, { storeId: context.scope.storeId, range: input.range }),
    ),
}
