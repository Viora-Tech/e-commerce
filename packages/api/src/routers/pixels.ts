import { settingsSecret } from '@commerce/config'
import { CommerceError, permissions } from '@commerce/core'
import {
  CreatePixelSchema,
  clearPixelToken,
  createPixel,
  getPixel,
  getPixelLog,
  listPixelLog,
  listPixels,
  PixelLogFilterSchema,
  pixelStats,
  pixelsInstalled,
  removePixel,
  SetPixelTokenSchema,
  sendPixelTest,
  setPixelStatus,
  setPixelToken,
  UpdatePixelSchema,
  updatePixel,
} from '@commerce/core/pixels/server'
import type { StoreTx } from '@commerce/db'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { can } from '../procedures'

/*
 * Pixels app (Meta Pixel + Conversions API). Responses carry `tokenHint` only: the token is
 * never read back, and `setToken` / `clearToken` are left out of MCP (action-catalogue.ts).
 */

type Ctx = { tx: StoreTx; scope: { storeId: string; userId?: string | undefined } }

async function installed(context: Ctx): Promise<void> {
  if (!(await pixelsInstalled(context.tx, context.scope.storeId))) {
    throw new ORPCError('PRECONDITION_FAILED', { message: 'Install the Pixels app first' })
  }
}

/** A Pixels refusal ("Meta refused this token") reaches the admin as its own words. */
async function refusal<T>(context: Ctx, fn: () => Promise<T>): Promise<T> {
  await installed(context)
  try {
    return await fn()
  } catch (err) {
    if (err instanceof CommerceError) {
      const code = err.code.endsWith('NOT_FOUND') ? 'NOT_FOUND' : 'PRECONDITION_FAILED'
      throw new ORPCError(code, { message: err.message })
    }
    throw err
  }
}

const Id = z.object({ id: z.uuid() })

export const pixelsRouter = {
  list: can(permissions.MARKETING_READ).handler(({ context }) =>
    refusal(context, () => listPixels(context.tx)),
  ),
  get: can(permissions.MARKETING_READ)
    .input(Id)
    .handler(({ context, input }) => refusal(context, () => getPixel(context.tx, input.id))),
  /** The last 7 days: events sent, purchases, failures and skips for no consent. */
  stats: can(permissions.MARKETING_READ).handler(({ context }) =>
    refusal(context, () => pixelStats(context.tx)),
  ),
  create: can(permissions.MARKETING_WRITE)
    .input(CreatePixelSchema)
    .handler(({ context, input }) =>
      refusal(context, () =>
        createPixel(context.tx, context.scope.storeId, input, {
          settingsSecret: settingsSecret(),
          userId: context.scope.userId,
        }),
      ),
    ),
  update: can(permissions.MARKETING_WRITE)
    .input(UpdatePixelSchema)
    .handler(({ context, input }) => refusal(context, () => updatePixel(context.tx, input))),
  /** Checked with Meta first; stored encrypted. Not reachable over MCP. */
  setToken: can(permissions.MARKETING_WRITE)
    .input(SetPixelTokenSchema)
    .handler(({ context, input }) =>
      refusal(context, () =>
        setPixelToken(context.tx, input, { settingsSecret: settingsSecret() }),
      ),
    ),
  clearToken: can(permissions.MARKETING_WRITE)
    .input(Id)
    .handler(({ context, input }) => refusal(context, () => clearPixelToken(context.tx, input.id))),
  setStatus: can(permissions.MARKETING_WRITE)
    .input(Id.extend({ status: z.enum(['active', 'paused']) }))
    .handler(({ context, input }) =>
      refusal(context, () => setPixelStatus(context.tx, input.id, input.status)),
    ),
  remove: can(permissions.MARKETING_WRITE)
    .input(Id)
    .handler(async ({ context, input }) => {
      await refusal(context, () => removePixel(context.tx, input.id))
      return { ok: true as const }
    }),
  /** One PageView with the test event code, sent now (10 s timeout). */
  sendTest: can(permissions.MARKETING_WRITE)
    .input(Id)
    .handler(({ context, input }) =>
      refusal(context, () =>
        sendPixelTest(context.tx, context.scope.storeId, input.id, {
          settingsSecret: settingsSecret(),
        }),
      ),
    ),
  log: {
    list: can(permissions.MARKETING_READ)
      .input(PixelLogFilterSchema)
      .handler(({ context, input }) => refusal(context, () => listPixelLog(context.tx, input))),
    get: can(permissions.MARKETING_READ)
      .input(Id)
      .handler(({ context, input }) => refusal(context, () => getPixelLog(context.tx, input.id))),
  },
}
