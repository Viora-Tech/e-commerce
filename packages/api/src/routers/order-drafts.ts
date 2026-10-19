import { loadEnv, settingsSecret } from '@commerce/config'
import {
  ABANDONED_LIST_STATUSES,
  DRAFT_LIST_STATUSES,
  DraftInputSchema,
  insertOutboxEvent,
  permissions,
} from '@commerce/core'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { can, PAGE_SIZE_MAX, SEARCH_MAX } from '../procedures'
import { storeRegistries } from '../services/apps.service'
import {
  convertStoreDraft,
  draftTiles,
  getDraft,
  getStoreAbandoned,
  listStoreAbandoned,
  listStoreDrafts,
  recordInvoiceSent,
  removeDraft,
  removeDrafts,
  saveDraft,
  sendRecovery,
  storeAbandonedStats,
} from '../services/draft.service'

const storefrontUrl = () => loadEnv(process.env).STOREFRONT_URL
const recoveryLink = () => ({ settingsSecret: settingsSecret(), storefrontUrl: storefrontUrl() })

/** Draft orders and abandoned checkouts, mounted flat on `orders` (`orders.listDrafts`, ...). */
export const draftAndAbandonedRoutes = {
  /* Draft orders: built by hand in admin, invisible to the storefront until converted. */

  listDrafts: can(permissions.DRAFTS_READ)
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        perPage: z.number().int().min(1).max(PAGE_SIZE_MAX).default(25),
        search: z.string().trim().max(SEARCH_MAX).optional(),
        status: z.enum(DRAFT_LIST_STATUSES).optional(),
      }),
    )
    .handler(({ context, input }) => listStoreDrafts(context.tx, context.scope.storeId, input)),

  draftTiles: can(permissions.DRAFTS_READ).handler(({ context }) => draftTiles(context.tx)),

  getDraft: can(permissions.DRAFTS_READ)
    .input(z.object({ id: z.uuid() }))
    .handler(({ context, input }) => getDraft(context.tx, input.id)),

  saveDraft: can(permissions.DRAFTS_WRITE)
    .input(z.object({ id: z.uuid().optional(), draft: DraftInputSchema }))
    .handler(({ context, input }) => saveDraft(context.tx, context.scope.storeId, input)),

  deleteDraft: can(permissions.DRAFTS_WRITE)
    .input(z.object({ id: z.uuid() }))
    .handler(({ context, input }) => removeDraft(context.tx, context.scope.storeId, input.id)),

  /** The list's bulk delete; ids that are no longer drafts are skipped. */
  deleteDrafts: can(permissions.DRAFTS_WRITE)
    .input(z.object({ ids: z.array(z.uuid()).min(1).max(PAGE_SIZE_MAX) }))
    .handler(({ context, input }) => removeDrafts(context.tx, context.scope.storeId, input.ids)),

  /** Email the shopper a pay link for the draft. */
  sendInvoice: can(permissions.DRAFTS_WRITE)
    .input(z.object({ id: z.uuid() }))
    .handler(async ({ context, input }) => {
      const draft = await getDraft(context.tx, input.id)
      if (!draft) throw new ORPCError('NOT_FOUND', { message: 'Draft not found' })
      if (!draft.email) {
        throw new ORPCError('BAD_REQUEST', { message: 'Add an email address first' })
      }
      await recordInvoiceSent(context.tx, context.scope.storeId, input.id, draft.email)
      await insertOutboxEvent(context.tx, context.scope.storeId, 'draft.invoice_sent', {
        orderId: input.id,
      })
      return { sentTo: draft.email }
    }),

  convertDraft: can(permissions.DRAFTS_WRITE)
    .input(z.object({ id: z.uuid(), paymentMethod: z.string().trim().max(60).optional() }))
    .handler(async ({ context, input }) => {
      const row = await convertStoreDraft(context.tx, context.scope.storeId, input)
      await insertOutboxEvent(context.tx, context.scope.storeId, 'order.placed', {
        orderId: input.id,
      })
      return row
    }),

  /* Abandoned checkouts: carts that captured a contact and went quiet. */

  listAbandoned: can(permissions.ORDERS_READ)
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        perPage: z.number().int().min(1).max(PAGE_SIZE_MAX).default(25),
        sinceDays: z.number().int().min(1).max(90).default(30),
        status: z.enum(ABANDONED_LIST_STATUSES).optional(),
        search: z.string().trim().max(SEARCH_MAX).optional(),
      }),
    )
    .handler(({ context, input }) => listStoreAbandoned(context.tx, context.scope.storeId, input)),

  abandonedStats: can(permissions.ORDERS_READ)
    .input(z.object({ days: z.number().int().min(1).max(90).optional() }).optional())
    .handler(({ context, input }) =>
      storeAbandonedStats(context.tx, context.scope.storeId, input?.days),
    ),

  getAbandoned: can(permissions.ORDERS_READ)
    .input(z.object({ id: z.uuid() }))
    .handler(({ context, input }) =>
      getStoreAbandoned(context.tx, context.scope.storeId, input.id, recoveryLink()),
    ),

  sendRecovery: can(permissions.ORDERS_WRITE)
    .input(z.object({ cartId: z.uuid() }))
    .handler(async ({ context, input }) => {
      const { notifications } = await storeRegistries(context.tx, context.scope.storeId)
      return sendRecovery(context.tx, context.scope.storeId, {
        cartId: input.cartId,
        registry: notifications,
        settingsSecret: settingsSecret(),
        storefrontUrl: storefrontUrl(),
      })
    }),
}
