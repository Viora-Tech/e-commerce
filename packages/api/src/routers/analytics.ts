import { permissions } from '@commerce/core'
import { z } from 'zod'
import { can } from '../procedures'
import { analyticsLive, analyticsOverview } from '../services/analytics.service'
import { analyticsReport } from '../services/analytics-report.service'
import { REPORTS } from '../services/analytics-reports'

const rangeInput = z.object({
  key: z.enum(['today', '7d', '30d', '90d', 'custom']).default('30d'),
  /** ISO dates, read only when `key` is `custom`. */
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
})

export const analyticsRouter = {
  /** KPI tiles, sales over time, breakdown cards and the funnel for one range. */
  overview: can(permissions.ANALYTICS_READ)
    .input(z.object({ range: rangeInput.default({ key: '30d' }) }))
    .handler(({ context, input }) =>
      analyticsOverview(context.tx, {
        range: input.range,
        storeId: context.scope.storeId,
        visitors: context.visitors,
      }),
    ),

  /** Visitors now, carts in flight and the last hour of activity. */
  live: can(permissions.ANALYTICS_READ).handler(({ context }) =>
    analyticsLive(context.tx, {
      storeId: context.scope.storeId,
      visitors: context.visitors,
    }),
  ),

  /** The report catalogue; static, so the page can render before any query runs. */
  reports: can(permissions.ANALYTICS_READ).handler(() => REPORTS),

  report: can(permissions.ANALYTICS_READ)
    .input(
      z.object({
        slug: z.string().trim().min(1).max(60),
        range: rangeInput.default({ key: '30d' }),
      }),
    )
    .handler(({ context, input }) =>
      analyticsReport(context.tx, input.slug, { range: input.range }),
    ),
}
