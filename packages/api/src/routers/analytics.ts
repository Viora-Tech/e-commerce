import { permissions } from '@commerce/core'
import { z } from 'zod'
import { can } from '../procedures'
import { analyticsLive, analyticsOverview, bigSaleDays } from '../services/analytics.service'
import { runCustomQuery } from '../services/analytics-query.service'
import { analyticsReport } from '../services/analytics-report.service'
import { REPORTS } from '../services/analytics-reports'
import {
  deleteSavedReport,
  listSavedReports,
  renameSavedReport,
  saveReport,
} from '../services/saved-reports.service'

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

  /** The store's biggest sales days in the last year, for the date picker's "Big sale days". */
  bigSaleDays: can(permissions.ANALYTICS_READ).handler(({ context }) => bigSaleDays(context.tx)),

  /** Runs a custom query (Figma "query editor"): parsed, then fixed SQL only, read-only. */
  query: can(permissions.ANALYTICS_READ)
    .input(z.object({ source: z.string().max(4000) }))
    .handler(({ context, input }) => runCustomQuery(context.tx, input.source)),

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

  /** Reports saved under the merchant's own name: a catalogue report and its range. */
  savedReports: can(permissions.ANALYTICS_READ).handler(({ context }) =>
    listSavedReports(context.tx),
  ),

  saveReport: can(permissions.ANALYTICS_READ)
    .input(
      z.object({
        name: z.string().trim().min(1).max(120),
        reportSlug: z.string().trim().min(1).max(60),
        range: rangeInput,
      }),
    )
    .handler(({ context, input }) =>
      saveReport(context.tx, context.scope.storeId, input, context.session?.user?.id ?? null),
    ),

  renameSavedReport: can(permissions.ANALYTICS_READ)
    .input(z.object({ id: z.uuid(), name: z.string().trim().min(1).max(120) }))
    .handler(({ context, input }) => renameSavedReport(context.tx, input.id, input.name)),

  deleteSavedReport: can(permissions.ANALYTICS_READ)
    .input(z.object({ id: z.uuid() }))
    .handler(({ context, input }) => deleteSavedReport(context.tx, input.id)),
}
