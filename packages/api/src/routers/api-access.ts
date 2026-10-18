import {
  ApiActivityQuerySchema,
  apiActivityCsv,
  CreateTokenSchema,
  createAccessToken,
  listApiActivity,
  listApiGrants,
  loadMcpOverview,
  McpSettingsSchema,
  permissions,
  revokeApiGrant,
  saveMcpSettings,
} from '@commerce/core'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { can } from '../procedures'

/** Settings → MCP & API: the server's switches, connected clients, access tokens and activity. */
export const apiAccessRouter = {
  overview: can(permissions.SETTINGS_READ).handler(({ context }) =>
    loadMcpOverview({ tx: context.tx, storeId: context.scope.storeId }),
  ),
  saveSettings: can(permissions.SETTINGS_MANAGE)
    .input(McpSettingsSchema)
    .handler(({ context, input }) =>
      saveMcpSettings({ tx: context.tx, storeId: context.scope.storeId }, input),
    ),
  grants: can(permissions.SETTINGS_READ).handler(({ context }) =>
    listApiGrants({ tx: context.tx, storeId: context.scope.storeId }),
  ),
  /** The plain token is in this answer only; the store keeps a hash. */
  createToken: can(permissions.SETTINGS_MANAGE)
    .input(CreateTokenSchema)
    .handler(({ context, input }) =>
      createAccessToken(
        { tx: context.tx, storeId: context.scope.storeId },
        context.scope.userId,
        input,
      ),
    ),
  revoke: can(permissions.SETTINGS_MANAGE)
    .input(z.object({ id: z.string().uuid() }))
    .handler(async ({ context, input }) => {
      const done = await revokeApiGrant(
        { tx: context.tx, storeId: context.scope.storeId },
        input.id,
        context.scope.userId,
      )
      if (!done)
        throw new ORPCError('NOT_FOUND', { message: 'That client or token is already gone.' })
      return { ok: true }
    }),
  activity: can(permissions.SETTINGS_READ)
    .input(ApiActivityQuerySchema)
    .handler(({ context, input }) =>
      listApiActivity({ tx: context.tx, storeId: context.scope.storeId }, input),
    ),
  activityCsv: can(permissions.SETTINGS_READ).handler(({ context }) =>
    apiActivityCsv({ tx: context.tx, storeId: context.scope.storeId }),
  ),
}
