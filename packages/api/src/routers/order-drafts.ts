import { loadEnv, settingsSecret } from '@commerce/config'
import {
  ABANDONED_CONTACTS,
  ABANDONED_LIST_STATUSES,
  DRAFT_LIST_STATUSES,
  DRAFT_SOURCES,
  DraftInputSchema,
  insertOutboxEvent,
  permissions,
  releaseDraft,
  reserveDraft,
  storefrontOriginFor,
  thankYouUrl,
} from '@commerce/core'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { can, PAGE_SIZE_MAX, SEARCH_MAX } from '../procedures'
import { storeRegistries } from '../services/apps.service'
import {
  checkStoreDraftDiscount,
  convertStoreDraft,
  draftEmail,
  draftTiles,
  duplicateStoreOrder,
  estimateStoreDraftGst,
  getDraft,
  getStoreAbandoned,
  listStoreAbandoned,
  listStoreDrafts,
  previewRecovery,
  recordInvoiceSent,
  removeDraft,
  removeDrafts,
  saveDraft,
  sendRecovery,
  storeAbandonedStats,
} from '../services/draft.service'
import { markDraftSeen } from '../services/drafts-seen.service'
import { customMessage } from './custom-message'

const storefrontUrl = () => loadEnv(process.env).STOREFRONT_URL
const recoveryLink = () => ({ settingsSecret: settingsSecret(), storefrontUrl: storefrontUrl() })

/** Draft orders and abandoned checkouts, mounted flat on `orders` (`orders.listDrafts`, ...). */
export const draftAndAbandonedRoutes = {
  /* Draft orders: built by hand in admin, invisible to the storefront until converted. */

  /** Draft orders, a page at a time, filtered by status or a search. */
  listDrafts: can(permissions.DRAFTS_READ)
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        perPage: z.number().int().min(1).max(PAGE_SIZE_MAX).default(25),
        search: z.string().trim().max(SEARCH_MAX).optional(),
        status: z.enum(DRAFT_LIST_STATUSES).optional(),
        /** `checkout`: shoppers' unpaid checkouts; `staff`: drafts built in the admin. */
        source: z.enum(DRAFT_SOURCES).optional(),
        /** Created at or after / before these moments (the filter panel's Created). */
        createdFrom: z.iso.datetime().optional(),
        createdTo: z.iso.datetime().optional(),
        /** Draft total at least / at most, in paise. */
        totalMinPaise: z.number().int().min(0).optional(),
        totalMaxPaise: z.number().int().min(0).optional(),
      }),
    )
    .handler(({ context, input }) => listStoreDrafts(context.tx, context.scope.storeId, input)),

  /** The stat cards above the drafts list: open drafts, invoices sent, and their total value. */
  draftTiles: can(permissions.DRAFTS_READ).handler(({ context }) => draftTiles(context.tx)),

  /** The member opened one draft: it leaves the sidebar's unseen checkout drafts count. */
  markDraftSeen: can(permissions.DRAFTS_READ)
    .input(z.object({ id: z.uuid() }))
    .handler(({ context, input }) =>
      markDraftSeen(context.tx, context.scope.storeId, context.scope.userId, input.id),
    ),

  /** One draft order with its lines, customer, addresses and totals. */
  getDraft: can(permissions.DRAFTS_READ)
    .input(z.object({ id: z.uuid() }))
    .handler(async ({ context, input }) => {
      const draft = await getDraft(context.tx, input.id)
      if (draft?.draftSource !== 'checkout') return draft ? { ...draft, payLink: null } : null
      // A shopper's unpaid checkout: the signed link to its page, where they pay or retry.
      const origin = await storefrontOriginFor(context.tx, context.scope.storeId, storefrontUrl())
      return {
        ...draft,
        payLink: thankYouUrl(draft.id, draft.number, settingsSecret(), origin),
      }
    }),

  /** Create a draft order (no id) or replace an existing draft's lines, customer and addresses. */
  saveDraft: can(permissions.DRAFTS_WRITE)
    .input(z.object({ id: z.uuid().optional(), draft: DraftInputSchema }))
    .handler(({ context, input }) => saveDraft(context.tx, context.scope.storeId, input)),

  /**
   * Check a store discount code against a draft's lines and customer with checkout's rules
   * (dates, minimums, products and collections, eligibility, per-customer cap). Nothing is
   * saved; saving the draft with `discountCode` applies it.
   */
  checkDraftDiscount: can(permissions.DRAFTS_WRITE)
    .input(
      z.object({
        code: z.string().trim().min(1).max(60),
        lines: DraftInputSchema.shape.lines,
        email: z.string().trim().max(200).nullish(),
        stateCode: z.string().trim().max(3).nullish(),
        shippingPaise: z.number().int().min(0).default(0),
      }),
    )
    .handler(({ context, input }) =>
      checkStoreDraftDiscount(context.tx, context.scope.storeId, input),
    ),

  /**
   * The GST inside a draft's total as converting would bill it (each line's rate, the discount
   * spread over the lines, shipping with the goods). Prices include GST, so the total is unchanged.
   */
  estimateDraftGst: can(permissions.DRAFTS_WRITE)
    .input(
      z.object({
        lines: DraftInputSchema.shape.lines,
        totalPaise: z.number().int().min(0),
        reductionPaise: z.number().int().min(0).default(0),
        stateCode: z.string().trim().max(3).nullish(),
      }),
    )
    .handler(({ context, input }) =>
      estimateStoreDraftGst(context.tx, context.scope.storeId, {
        lines: input.lines,
        totalPaise: input.totalPaise,
        reductionPaise: input.reductionPaise,
        stateCode: input.stateCode ?? null,
      }),
    ),

  /**
   * Start a new draft from an existing order: same customer, address, lines at today's
   * prices (archived products skipped and named), notes and shipping. Never places an order.
   */
  duplicateOrder: can(permissions.DRAFTS_WRITE)
    .input(z.object({ id: z.uuid() }))
    .handler(({ context, input }) =>
      duplicateStoreOrder(context.tx, context.scope.storeId, input.id),
    ),

  /** Delete one draft order; placed orders cannot be deleted this way. */
  deleteDraft: can(permissions.DRAFTS_WRITE)
    .input(z.object({ id: z.uuid() }))
    .handler(({ context, input }) => removeDraft(context.tx, context.scope.storeId, input.id)),

  /** The list's bulk delete; ids that are no longer drafts are skipped. */
  deleteDrafts: can(permissions.DRAFTS_WRITE)
    .input(z.object({ ids: z.array(z.uuid()).min(1).max(PAGE_SIZE_MAX) }))
    .handler(({ context, input }) => removeDrafts(context.tx, context.scope.storeId, input.ids)),

  /** Email the shopper a pay link for the draft. */
  sendInvoice: can(permissions.DRAFTS_WRITE)
    .input(z.object({ id: z.uuid(), custom: customMessage }))
    .handler(async ({ context, input }) => {
      const draft = await getDraft(context.tx, input.id)
      if (!draft) throw new ORPCError('NOT_FOUND', { message: 'Draft not found' })
      if (!draft.email) {
        throw new ORPCError('BAD_REQUEST', { message: 'Add an email address first' })
      }
      await recordInvoiceSent(context.tx, context.scope.storeId, input.id, draft.email)
      await insertOutboxEvent(context.tx, context.scope.storeId, 'draft.invoice_sent', {
        orderId: input.id,
        custom: input.custom,
      })
      return { sentTo: draft.email }
    }),

  /** The list's bulk "Send invoices": each selected draft with an email gets its pay link. */
  sendInvoices: can(permissions.DRAFTS_WRITE)
    .input(z.object({ ids: z.array(z.uuid()).min(1).max(PAGE_SIZE_MAX) }))
    .handler(async ({ context, input }) => {
      let sent = 0
      let skipped = 0
      for (const id of input.ids) {
        const email = await draftEmail(context.tx, id)
        if (!email) {
          skipped++
          continue
        }
        await recordInvoiceSent(context.tx, context.scope.storeId, id, email)
        await insertOutboxEvent(context.tx, context.scope.storeId, 'draft.invoice_sent', {
          orderId: id,
        })
        sent++
      }
      return { sent, skipped }
    }),

  /**
   * Reserve items (#1030): hold the saved draft's stock until a date, so no one else can buy it.
   * Converting or deleting the draft, or the date passing, gives it back.
   */
  reserveDraft: can(permissions.DRAFTS_WRITE)
    .input(z.object({ id: z.uuid(), until: z.iso.datetime({ offset: true }) }))
    .handler(async ({ context, input }) => {
      const held = await reserveDraft(
        { storeId: context.scope.storeId, tx: context.tx },
        input.id,
        new Date(input.until),
      )
      if (!held) throw new ORPCError('NOT_FOUND', { message: 'Draft not found' })
      return held
    }),

  /** Stop holding a draft's items; they go back on sale. */
  releaseDraft: can(permissions.DRAFTS_WRITE)
    .input(z.object({ id: z.uuid() }))
    .handler(async ({ context, input }) => ({
      released: await releaseDraft({ storeId: context.scope.storeId, tx: context.tx }, input.id),
    })),

  /** Place a draft as a real order: holds stock and records a pending payment for the chosen method. */
  convertDraft: can(permissions.DRAFTS_WRITE)
    .input(z.object({ id: z.uuid(), paymentMethod: z.string().trim().max(60).optional() }))
    .handler(async ({ context, input }) => {
      const row = await convertStoreDraft(context.tx, context.scope.storeId, input)
      // A shopper's unpaid checkout announces itself as it converts (order/checkout-draft.ts).
      if (row.draftSource !== 'checkout') {
        await insertOutboxEvent(context.tx, context.scope.storeId, 'order.placed', {
          orderId: input.id,
        })
      }
      return row
    }),

  /* Abandoned checkouts: carts that captured a contact and went quiet. */

  /** Abandoned checkouts from recent days, a page at a time, by recovery status or a search. */
  listAbandoned: can(permissions.ORDERS_READ)
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        perPage: z.number().int().min(1).max(PAGE_SIZE_MAX).default(25),
        sinceDays: z.number().int().min(1).max(90).default(30),
        status: z.enum(ABANDONED_LIST_STATUSES).optional(),
        search: z.string().trim().max(SEARCH_MAX).optional(),
        /** Last active at or after / before these moments; `from` replaces `sinceDays`. */
        activeFrom: z.iso.datetime().optional(),
        activeTo: z.iso.datetime().optional(),
        /** Cart value at least / at most, in paise. */
        valueMinPaise: z.number().int().min(0).optional(),
        valueMaxPaise: z.number().int().min(0).optional(),
        /** Left an email, a phone number, or both. */
        contact: z.enum(ABANDONED_CONTACTS).optional(),
      }),
    )
    .handler(({ context, input }) => listStoreAbandoned(context.tx, context.scope.storeId, input)),

  /** Abandoned checkouts in a period: how many, their value, and how many were recovered. */
  abandonedStats: can(permissions.ORDERS_READ)
    .input(z.object({ days: z.number().int().min(1).max(90).optional() }).optional())
    .handler(({ context, input }) =>
      storeAbandonedStats(context.tx, context.scope.storeId, input?.days),
    ),

  /** One abandoned checkout with its cart, contact and recovery link. */
  getAbandoned: can(permissions.ORDERS_READ)
    .input(z.object({ id: z.uuid() }))
    .handler(({ context, input }) =>
      getStoreAbandoned(context.tx, context.scope.storeId, input.id, recoveryLink()),
    ),

  /** The reminder as the shopper would get it, for the "Review email" dialog. Nothing is sent. */
  previewRecovery: can(permissions.ORDERS_READ)
    .input(z.object({ cartId: z.uuid(), custom: customMessage }))
    .handler(async ({ context, input }) => {
      const { notifications } = await storeRegistries(context.tx, context.scope.storeId)
      return previewRecovery(context.tx, context.scope.storeId, {
        cartId: input.cartId,
        custom: input.custom,
        registry: notifications,
        settingsSecret: settingsSecret(),
        storefrontUrl: storefrontUrl(),
      })
    }),

  /** Email the shopper a reminder with a link back to their abandoned cart. */
  sendRecovery: can(permissions.ORDERS_WRITE)
    .input(z.object({ cartId: z.uuid(), custom: customMessage }))
    .handler(async ({ context, input }) => {
      const { notifications } = await storeRegistries(context.tx, context.scope.storeId)
      return sendRecovery(context.tx, context.scope.storeId, {
        cartId: input.cartId,
        custom: input.custom,
        registry: notifications,
        settingsSecret: settingsSecret(),
        storefrontUrl: storefrontUrl(),
      })
    }),
}
