import { storeProcedure } from '../procedures'
import { dashboardSummary } from '../services/dashboard.service'

export const dashboardRouter = {
  /** Stat windows, weekly report, recent orders, top products and low stock for the home page. */
  summary: storeProcedure.handler(({ context }) => dashboardSummary(context.tx)),
}
