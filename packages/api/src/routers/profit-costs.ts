import {
  ProfitCostSettingsSchema,
  permissions,
  profitCostsView,
  saveProfitCosts,
} from '@commerce/core'
import { can } from '../procedures'

/** Settings › Costs for profit: what each payment method and cash on delivery cost the store. */
export const profitCostsRouter = {
  get: can(permissions.SETTINGS_READ).handler(({ context }) =>
    profitCostsView(context.tx, context.scope.storeId),
  ),
  save: can(permissions.SETTINGS_MANAGE)
    .input(ProfitCostSettingsSchema)
    .handler(({ context, input }) => saveProfitCosts(context.tx, context.scope.storeId, input)),
}
