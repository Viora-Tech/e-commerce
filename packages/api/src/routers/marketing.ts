import { loadEnv } from '@commerce/config'
import {
  CampaignInputSchema,
  CampaignLocked,
  CampaignNotReady,
  cancelCampaign,
  createCampaign,
  deleteCampaign,
  duplicateCampaign,
  EmailBlocksSchema,
  listCampaigns,
  permissions,
  scheduleCampaign,
  testSendCampaignEmail,
  updateCampaign,
} from '@commerce/core'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { can } from '../procedures'
import {
  audienceSize,
  campaignDetail,
  marketingDeps,
  marketingSetup,
  whatsappTemplates,
} from '../services/marketing-campaigns.service'
import { marketingOverview } from '../services/marketing-overview.service'

const rangeInput = z.object({
  key: z.enum(['today', '7d', '30d', '90d', 'custom']).default('30d'),
  /** ISO dates, read only when `key` is `custom`. */
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
})

const env = () => {
  const e = loadEnv(process.env)
  return { settingsSecret: e.SETTINGS_SECRET, storefrontUrl: e.STOREFRONT_URL }
}

/** Campaign rule breaks become 409s the editor can show as they are. */
function surface<T>(work: () => Promise<T>): Promise<T> {
  return work().catch((err: unknown) => {
    if (err instanceof CampaignLocked || err instanceof CampaignNotReady) {
      throw new ORPCError('CONFLICT', { message: err.message })
    }
    throw err
  })
}

const id = z.object({ id: z.uuid() })

export const marketingRouter = {
  /** Sessions, attributed sales, channels and top campaigns for one range. */
  overview: can(permissions.MARKETING_READ)
    .input(z.object({ range: rangeInput.default({ key: '30d' }) }))
    .handler(({ context, input }) => marketingOverview(context.tx, { range: input.range })),

  /** Which channels can carry marketing for this store. */
  setup: can(permissions.MARKETING_READ).handler(async ({ context }) =>
    marketingSetup(
      context.tx,
      context.scope.storeId,
      await marketingDeps(context.tx, context.scope.storeId, env()),
    ),
  ),

  campaigns: {
    list: can(permissions.MARKETING_READ)
      .input(z.object({ kind: z.enum(['email', 'whatsapp']).optional() }).default({}))
      .handler(({ context, input }) => listCampaigns(context.tx, input)),

    get: can(permissions.MARKETING_READ)
      .input(id)
      .handler(({ context, input }) => campaignDetail(context.tx, input.id)),

    create: can(permissions.MARKETING_WRITE)
      .input(CampaignInputSchema)
      .handler(({ context, input }) => createCampaign(context.tx, context.scope.storeId, input)),

    update: can(permissions.MARKETING_WRITE)
      .input(z.object({ id: z.uuid(), data: CampaignInputSchema }))
      .handler(({ context, input }) =>
        surface(() => updateCampaign(context.tx, context.scope.storeId, input.id, input.data)),
      ),

    delete: can(permissions.MARKETING_WRITE)
      .input(id)
      .handler(({ context, input }) => surface(() => deleteCampaign(context.tx, input.id))),

    duplicate: can(permissions.MARKETING_WRITE)
      .input(z.object({ id: z.uuid(), prefix: z.string().max(20).default('Copy of') }))
      .handler(({ context, input }) =>
        duplicateCampaign(context.tx, context.scope.storeId, input.id, input.prefix),
      ),

    /** Send now (no `at`) or at a time; the worker picks it up within a minute. */
    schedule: can(permissions.MARKETING_SEND)
      .input(
        z.object({
          id: z.uuid(),
          at: z.iso.datetime({ offset: true }).nullable().default(null),
          variableCount: z.number().int().min(0).max(20).optional(),
        }),
      )
      .handler(({ context, input }) =>
        surface(() =>
          scheduleCampaign(context.tx, input.id, {
            at: input.at ? new Date(input.at) : null,
            variableCount: input.variableCount,
          }),
        ),
      ),

    cancel: can(permissions.MARKETING_SEND)
      .input(id)
      .handler(({ context, input }) => surface(() => cancelCampaign(context.tx, input.id))),

    /** Customers the campaign would reach now: in the segment, consented, not unsubscribed. */
    audience: can(permissions.MARKETING_READ)
      .input(z.object({ kind: z.enum(['email', 'whatsapp']), segmentId: z.uuid().nullable() }))
      .handler(async ({ context, input }) => ({ count: await audienceSize(context.tx, input) })),

    /** Sends the editor's current content to one address, marked as a test. */
    testSend: can(permissions.MARKETING_SEND)
      .input(
        z.object({
          to: z.email().max(254),
          subject: z.string().max(200),
          previewText: z.string().max(200).default(''),
          blocks: EmailBlocksSchema,
          testPrefix: z.string().max(20).default('[Test]'),
        }),
      )
      .handler(async ({ context, input }) => {
        const r = await testSendCampaignEmail(
          context.tx,
          context.scope.storeId,
          await marketingDeps(context.tx, context.scope.storeId, env()),
          input,
        )
        if (!r.ok) throw new ORPCError('BAD_REQUEST', { message: r.error })
        return r
      }),

    /** Approved WhatsApp templates for the broadcast and automation pickers. */
    whatsappTemplates: can(permissions.MARKETING_READ).handler(async ({ context }) =>
      whatsappTemplates(
        context.tx,
        context.scope.storeId,
        await marketingDeps(context.tx, context.scope.storeId, env()),
      ),
    ),
  },
}
