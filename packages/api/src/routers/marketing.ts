import { loadEnv } from '@commerce/config'
import {
  AutomationInputSchema,
  AutopilotSettingsSchema,
  automationsEngineMode,
  type CampaignInput,
  CampaignInputSchema,
  CampaignLocked,
  CampaignNotReady,
  cancelCampaign,
  createCampaign,
  createEmailTemplate,
  createGrowthAutomation,
  deleteCampaign,
  deleteEmailTemplate,
  deleteGrowthAutomation,
  duplicateCampaign,
  EmailBlocksSchema,
  EmailDesignSchema,
  EmailTemplateInputSchema,
  EmailTemplateLimit,
  GrowthAutomationNotEditable,
  getEmailTemplate,
  getGrowthAutomation,
  listCampaigns,
  listEmailTemplates,
  listGrowthAutomations,
  permissions,
  RECOMMENDATION_IDS,
  scheduleCampaign,
  setGrowthAutomationStatus,
  testSendCampaignEmail,
  updateCampaign,
  updateGrowthAutomation,
} from '@commerce/core'
import { compileEmailDesign } from '@commerce/core/email-design-compile'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { can, canDetached } from '../procedures'
import { campaignPerformance } from '../services/campaign-performance.service'
import {
  approveAutopilotProposal,
  autopilotView,
  dismissAutopilotProposal,
  planAutopilotCampaigns,
  saveAutopilotSettings,
} from '../services/growth-autopilot.service'
import {
  dismissRecommendation,
  recommendationsFor,
} from '../services/growth-recommendations.service'
import {
  audienceSize,
  campaignDetail,
  emailBrand,
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

type Design = NonNullable<CampaignInput['design']>

/** The stored HTML is always compiled here from the design's MJML, never taken from the client. */
async function compiled<T extends Design | null>(design: T): Promise<T> {
  if (!design) return design
  const { html, errors } = await compileEmailDesign(design.mjml)
  if (design.mjml.trim() && !html) {
    throw new ORPCError('BAD_REQUEST', {
      message: `The design could not be compiled: ${errors[0] ?? 'unknown error'}`,
    })
  }
  return { ...design, html }
}

async function withCompiledDesign(input: CampaignInput): Promise<CampaignInput> {
  return { ...input, design: await compiled(input.design) }
}

const emailTemplatesRouter = {
  list: can(permissions.MARKETING_READ).handler(({ context }) => listEmailTemplates(context.tx)),

  get: can(permissions.MARKETING_READ)
    .input(id)
    .handler(({ context, input }) => getEmailTemplate(context.tx, input.id)),

  create: can(permissions.MARKETING_WRITE)
    .input(EmailTemplateInputSchema)
    .handler(async ({ context, input }) => {
      try {
        return await createEmailTemplate(context.tx, context.scope.storeId, {
          name: input.name,
          design: await compiled(input.design),
        })
      } catch (err) {
        if (err instanceof EmailTemplateLimit) {
          throw new ORPCError('CONFLICT', { message: err.message })
        }
        throw err
      }
    }),

  delete: can(permissions.MARKETING_WRITE)
    .input(id)
    .handler(({ context, input }) => deleteEmailTemplate(context.tx, input.id)),
}

/** Growth → Automations; legacy tables or the Automations engine, per store (`growth-automations.ts`). */
const automationsRouter = {
  list: can(permissions.MARKETING_READ).handler(({ context }) =>
    listGrowthAutomations(context.tx, context.scope.storeId),
  ),

  /** Which runner owns the store's automations: after the cutover Growth opens the Automations app. */
  mode: can(permissions.MARKETING_READ).handler(({ context }) =>
    automationsEngineMode(context.tx, context.scope.storeId),
  ),

  /** One automation with its stats and the latest runs. */
  get: can(permissions.MARKETING_READ)
    .input(id)
    .handler(({ context, input }) =>
      getGrowthAutomation(context.tx, context.scope.storeId, input.id),
    ),

  create: can(permissions.MARKETING_WRITE)
    .input(z.object({ template: z.string().trim().min(1).max(40) }))
    .handler(async ({ context, input }) => {
      const row = await createGrowthAutomation(
        context.tx,
        context.scope.storeId,
        input.template,
        context.session?.user?.id ?? null,
      )
      if (!row) throw new ORPCError('NOT_FOUND', { message: 'Unknown automation template' })
      return row
    }),

  update: can(permissions.MARKETING_WRITE)
    .input(z.object({ id: z.uuid(), data: AutomationInputSchema }))
    .handler(async ({ context, input }) => {
      try {
        return await updateGrowthAutomation(
          context.tx,
          context.scope.storeId,
          input.id,
          input.data,
          context.session?.user?.id ?? null,
        )
      } catch (err) {
        if (err instanceof GrowthAutomationNotEditable) {
          throw new ORPCError('CONFLICT', { message: err.message })
        }
        throw err
      }
    }),

  /** Turning an automation on starts enrolling at the next worker tick. */
  setStatus: can(permissions.MARKETING_SEND)
    .input(z.object({ id: z.uuid(), status: z.enum(['active', 'paused']) }))
    .handler(({ context, input }) =>
      setGrowthAutomationStatus(context.tx, context.scope.storeId, input.id, input.status),
    ),

  delete: can(permissions.MARKETING_WRITE)
    .input(id)
    .handler(({ context, input }) =>
      deleteGrowthAutomation(context.tx, context.scope.storeId, input.id),
    ),
}

const proposalId = z.object({ id: z.string().min(1).max(40) })

/** Growth → Autopilot: settings, proposed campaigns, approve or dismiss each one. */
const autopilotRouter = {
  get: can(permissions.MARKETING_READ).handler(({ context }) =>
    autopilotView(context.tx, context.scope.storeId),
  ),

  saveSettings: can(permissions.MARKETING_WRITE)
    .input(AutopilotSettingsSchema)
    .handler(({ context, input }) =>
      saveAutopilotSettings(context.tx, context.scope.storeId, input),
    ),

  /** Writes draft campaigns for the goals that need one; the AI writer runs outside a transaction. */
  plan: canDetached(permissions.MARKETING_WRITE).handler(({ context, signal }) =>
    planAutopilotCampaigns(context, new Date(), signal),
  ),

  /** Schedules the draft (adding its discount code) or switches cart reminders on. */
  approve: can(permissions.MARKETING_SEND)
    .input(proposalId)
    .handler(({ context, input }) =>
      approveAutopilotProposal(context.tx, context.scope.storeId, input.id),
    ),

  dismiss: can(permissions.MARKETING_WRITE)
    .input(proposalId)
    .handler(({ context, input }) =>
      dismissAutopilotProposal(context.tx, context.scope.storeId, input.id),
    ),
}

export const marketingRouter = {
  automations: automationsRouter,
  autopilot: autopilotRouter,
  emailTemplates: emailTemplatesRouter,

  /** Logo, colours and social links from the live theme, for the visual email builder. */
  emailBrand: can(permissions.MARKETING_READ).handler(async ({ context }) => {
    const deps = await marketingDeps(context.tx, context.scope.storeId, env())
    return emailBrand(context.tx, context.scope.storeId, deps.storefrontUrl)
  }),

  /** Sessions, attributed sales, channels and top campaigns for one range. */
  overview: can(permissions.MARKETING_READ)
    .input(z.object({ range: rangeInput.default({ key: '30d' }) }))
    .handler(({ context, input }) => marketingOverview(context.tx, { range: input.range })),

  /** Every campaign (our sends and tracking-link campaigns) with sessions and sales this year. */
  campaignPerformance: can(permissions.MARKETING_READ).handler(({ context }) =>
    campaignPerformance(context.tx),
  ),

  /** Growth overview recommendations: up to three rule-based next steps with their numbers. */
  recommendations: can(permissions.MARKETING_READ).handler(({ context }) =>
    recommendationsFor(context.tx, context.scope.storeId),
  ),

  /** Hides one recommendation for the whole store and returns the cards left to show. */
  dismissRecommendation: can(permissions.MARKETING_WRITE)
    .input(z.object({ id: z.enum(RECOMMENDATION_IDS) }))
    .handler(({ context, input }) =>
      dismissRecommendation(context.tx, context.scope.storeId, input.id),
    ),

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
      .handler(({ context, input }) =>
        surface(async () =>
          createCampaign(context.tx, context.scope.storeId, await withCompiledDesign(input)),
        ),
      ),

    update: can(permissions.MARKETING_WRITE)
      .input(z.object({ id: z.uuid(), data: CampaignInputSchema }))
      .handler(({ context, input }) =>
        surface(async () =>
          updateCampaign(
            context.tx,
            context.scope.storeId,
            input.id,
            await withCompiledDesign(input.data),
          ),
        ),
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
      .handler(async ({ context, input }) => ({
        count: await audienceSize(context.tx, input, env().settingsSecret),
      })),

    /** Sends the editor's current content to one address, marked as a test. */
    testSend: can(permissions.MARKETING_SEND)
      .input(
        z.object({
          to: z.email().max(254),
          subject: z.string().max(200),
          previewText: z.string().max(200).default(''),
          blocks: EmailBlocksSchema,
          /** The visual builder's design; sent instead of the blocks when present. */
          design: EmailDesignSchema.nullable().default(null),
          testPrefix: z.string().max(20).default('[Test]'),
        }),
      )
      .handler(async ({ context, input }) => {
        const r = await testSendCampaignEmail(
          context.tx,
          context.scope.storeId,
          await marketingDeps(context.tx, context.scope.storeId, env()),
          { ...input, designHtml: (await compiled(input.design))?.html || undefined },
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
