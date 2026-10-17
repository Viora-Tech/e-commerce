import {
  AgentControlsSchema,
  ConnectRequestSchema,
  cancelChannel,
  loadAgentControls,
  loadAgenticOverview,
  loadCatalogReadiness,
  loadSocialOverview,
  permissions,
  requestChannel,
  SOCIAL_CHANNELS,
  saveAgentControls,
} from '@commerce/core'
import { z } from 'zod'
import { can } from '../procedures'

/** Sales channels → Agentic sales and Social media. */
export const salesChannelsRouter = {
  agentic: can(permissions.ONLINE_STORE_READ).handler(({ context }) =>
    loadAgenticOverview({ tx: context.tx, storeId: context.scope.storeId }),
  ),
  readiness: can(permissions.ONLINE_STORE_READ).handler(({ context }) =>
    loadCatalogReadiness({ tx: context.tx, storeId: context.scope.storeId }),
  ),
  controls: can(permissions.ONLINE_STORE_READ).handler(({ context }) =>
    loadAgentControls({ tx: context.tx, storeId: context.scope.storeId }),
  ),
  saveControls: can(permissions.ONLINE_STORE_WRITE)
    .input(AgentControlsSchema)
    .handler(({ context, input }) =>
      saveAgentControls({ tx: context.tx, storeId: context.scope.storeId }, input),
    ),
  social: can(permissions.ONLINE_STORE_READ)
    .input(z.object({ channel: z.enum(SOCIAL_CHANNELS) }))
    .handler(({ context, input }) =>
      loadSocialOverview({ tx: context.tx, storeId: context.scope.storeId }, input.channel),
    ),
  connect: can(permissions.ONLINE_STORE_WRITE)
    .input(ConnectRequestSchema)
    .handler(({ context, input }) =>
      requestChannel({ tx: context.tx, storeId: context.scope.storeId }, input),
    ),
  cancel: can(permissions.ONLINE_STORE_WRITE)
    .input(z.object({ channel: ConnectRequestSchema.shape.channel }))
    .handler(({ context, input }) =>
      cancelChannel({ tx: context.tx, storeId: context.scope.storeId }, input.channel),
    ),
}
