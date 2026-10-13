import { loadSeoReport, permissions } from '@commerce/core'
import { can } from '../procedures'

/** Online store → SEO: the store's SEO score and the issues to fix, ranked by impact. */
export const seoRouter = {
  report: can(permissions.ONLINE_STORE_READ).handler(({ context }) =>
    loadSeoReport(context.tx, context.scope.storeId),
  ),
}
