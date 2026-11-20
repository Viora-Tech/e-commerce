import { loadSeoReport, permissions } from '@commerce/core'
import { can } from '../procedures'
import { agentReadinessCheck } from '../services/agent-readiness.service'

/** Online store → SEO: the store's SEO score and the issues to fix, ranked by impact. */
export const seoRouter = {
  report: can(permissions.ONLINE_STORE_READ).handler(({ context }) =>
    loadSeoReport(context.tx, context.scope.storeId),
  ),

  /**
   * Settings → Store health › AI shopping agents: the store's live site checked as a browser and
   * as AI bots (GET only); null without a live domain of its own.
   */
  agentReadiness: can(permissions.SETTINGS_READ).handler(({ context }) =>
    agentReadinessCheck(context.tx, context.scope.storeId),
  ),
}
