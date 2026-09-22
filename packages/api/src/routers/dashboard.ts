import { permissions } from '@commerce/core'
import { can } from '../procedures'
import { dashboardSummary } from '../services/dashboard.service'

export const dashboardRouter = {
  /** Stat windows, weekly report, recent orders, top products, live visitors and quick lists for the home page. */
  summary: can(permissions.ANALYTICS_READ).handler(({ context }) =>
    dashboardSummary(context.tx, {
      storeId: context.scope.storeId,
      visitors: context.visitors,
    }),
  ),
}
