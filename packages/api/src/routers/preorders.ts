import {
  createPreorderCampaign,
  deletePreorderCampaign,
  getPreorderCampaign,
  listPreorderCampaigns,
  PreorderCampaignCreateSchema,
  PreorderCampaignError,
  PreorderCampaignIdSchema,
  PreorderCampaignUpdateSchema,
  permissions,
  preorderOverview,
  updatePreorderCampaign,
} from '@commerce/core'
import type { StoreTx } from '@commerce/db'
import { ORPCError } from '@orpc/server'
import { can } from '../procedures'

type Ctx = { scope: { storeId: string }; tx: StoreTx }
const ctxOf = (context: Ctx) => ({ storeId: context.scope.storeId, tx: context.tx })

/** A missing campaign as a 404, keeping the words the admin shows. */
async function campaignErrors<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch (err) {
    if (err instanceof PreorderCampaignError)
      throw new ORPCError('NOT_FOUND', { message: err.message })
    throw err
  }
}

const read = () => can(permissions.PRODUCTS_READ)
const write = () => can(permissions.PRODUCTS_WRITE)

/** Products › Pre-orders: the overview and the campaigns (one rule set for many products). */
export const preordersRouter = {
  /** Last 30 days, every pre-order product with its limit, every campaign with its sales. */
  overview: read().handler(({ context }) => preorderOverview(ctxOf(context))),

  campaigns: {
    list: read().handler(({ context }) => listPreorderCampaigns(ctxOf(context))),

    get: read()
      .input(PreorderCampaignIdSchema)
      .handler(({ context, input }) =>
        campaignErrors(() => getPreorderCampaign(ctxOf(context), input.id)),
      ),

    create: write()
      .input(PreorderCampaignCreateSchema)
      .handler(({ context, input }) => createPreorderCampaign(ctxOf(context), input)),

    update: write()
      .input(PreorderCampaignUpdateSchema)
      .handler(({ context, input }) =>
        campaignErrors(() => updatePreorderCampaign(ctxOf(context), input)),
      ),

    /** Its products sell by their own pre-order settings again. */
    delete: write()
      .input(PreorderCampaignIdSchema)
      .handler(async ({ context, input }) => {
        await campaignErrors(() => deletePreorderCampaign(ctxOf(context), input.id))
        return { ok: true as const }
      }),
  },
}
