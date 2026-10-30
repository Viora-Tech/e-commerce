import { settingsSecret } from '@commerce/config'
import {
  changeGiftCardBalance,
  createGiftCardProduct,
  deliverGiftCard,
  GiftCardError,
  GiftCardSettingsSchema,
  getGiftCard,
  getGiftCardSettings,
  giftCardChannels,
  giftCardsForCustomer,
  issueGiftCard,
  listGiftCardProducts,
  listGiftCards,
  permissions,
  saveGiftCardSettings,
  setGiftCardDisabled,
  updateGiftCard,
} from '@commerce/core'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { can, PAGE_SIZE_MAX, SEARCH_MAX } from '../procedures'
import { storeRegistries } from '../services/apps.service'

const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
const STATES = ['active', 'disabled', 'expired', 'empty'] as const

/** Gift card rule breaks are the merchant's to fix, so they come back as 400s with the reason. */
function surface<T>(work: () => Promise<T>): Promise<T> {
  return work().catch((err: unknown) => {
    if (err instanceof GiftCardError) {
      throw new ORPCError(err.reason === 'code_taken' ? 'CONFLICT' : 'BAD_REQUEST', {
        message: err.message,
        data: { reason: err.reason },
      })
    }
    throw err
  })
}

/**
 * Gift cards live under Products in the admin, so they use the products
 * grants: reading needs products.read, issuing and changing balances
 * products.write.
 */
export const giftCardsRouter = {
  list: can(permissions.PRODUCTS_READ)
    .input(
      z.object({
        q: z.string().trim().max(SEARCH_MAX).optional(),
        state: z.enum(STATES).optional(),
        source: z
          .array(z.enum(['manual', 'purchase']))
          .max(2)
          .optional(),
        minBalancePaise: z.number().int().min(0).optional(),
        maxBalancePaise: z.number().int().min(0).optional(),
        expiresFrom: z.iso.date().optional(),
        expiresTo: z.iso.date().optional(),
        createdFrom: z.iso.datetime().optional(),
        createdTo: z.iso.datetime().optional(),
        page: z.number().int().min(1).default(1),
        perPage: z.number().int().min(1).max(PAGE_SIZE_MAX).default(50),
      }),
    )
    .handler(({ context, input }) =>
      listGiftCards(
        { storeId: context.scope.storeId, tx: context.tx },
        {
          q: input.q,
          state: input.state,
          source: input.source,
          minBalancePaise: input.minBalancePaise,
          maxBalancePaise: input.maxBalancePaise,
          expiresFrom: input.expiresFrom,
          expiresTo: input.expiresTo,
          createdFrom: input.createdFrom,
          createdTo: input.createdTo,
          limit: input.perPage,
          offset: (input.page - 1) * input.perPage,
        },
      ),
    ),

  get: can(permissions.PRODUCTS_READ)
    .input(z.object({ id: z.uuid() }))
    .handler(({ context, input }) =>
      getGiftCard({ storeId: context.scope.storeId, tx: context.tx }, input.id),
    ),

  forCustomer: can(permissions.CUSTOMERS_READ)
    .input(z.object({ customerId: z.uuid() }))
    .handler(({ context, input }) =>
      giftCardsForCustomer({ storeId: context.scope.storeId, tx: context.tx }, input.customerId),
    ),

  /** Issue a card. The code comes back in full exactly once; after this admin only sees the last four. */
  issue: can(permissions.PRODUCTS_WRITE)
    .input(
      z.object({
        valuePaise: z.number().int().positive(),
        code: z.string().trim().max(40).optional(),
        expiresOn: ymd.nullable().optional(),
        customerId: z.uuid().nullable().optional(),
        recipientEmail: z.email().nullable().optional(),
        recipientName: z.string().trim().max(120).nullable().optional(),
        message: z.string().trim().max(500).nullable().optional(),
        note: z.string().trim().max(1000).nullable().optional(),
        send: z.boolean().default(false),
      }),
    )
    .handler(({ context, input }) =>
      surface(async () => {
        const ctx = { storeId: context.scope.storeId, tx: context.tx }
        const { send, ...rest } = input
        const r = await issueGiftCard(
          ctx,
          { ...rest, createdBy: context.session.user.email },
          settingsSecret(),
        )
        if (!r) throw new Error('gift card was not issued')
        let delivery: Awaited<ReturnType<typeof deliverGiftCard>> = []
        if (send) {
          const { notifications } = await storeRegistries(context.tx, context.scope.storeId)
          const channels = await giftCardChannels(ctx, notifications, settingsSecret())
          delivery = await deliverGiftCard(ctx, r.card.id, { channels, secret: settingsSecret() })
        }
        return { id: r.card.id, code: r.code, delivery }
      }),
    ),

  update: can(permissions.PRODUCTS_WRITE)
    .input(
      z.object({
        id: z.uuid(),
        expiresOn: ymd.nullable().optional(),
        note: z.string().trim().max(1000).nullable().optional(),
        customerId: z.uuid().nullable().optional(),
        recipientEmail: z.email().nullable().optional(),
        recipientName: z.string().trim().max(120).nullable().optional(),
        /** Most checkouts that may spend it (#993); null removes the limit. */
        usageLimit: z.number().int().min(1).max(100000).nullable().optional(),
      }),
    )
    .handler(({ context, input }) => {
      const { id, ...patch } = input
      return updateGiftCard({ storeId: context.scope.storeId, tx: context.tx }, id, patch)
    }),

  setDisabled: can(permissions.PRODUCTS_WRITE)
    .input(z.object({ id: z.uuid(), disabled: z.boolean() }))
    .handler(({ context, input }) =>
      setGiftCardDisabled(
        { storeId: context.scope.storeId, tx: context.tx },
        input.id,
        input.disabled,
      ),
    ),

  adjust: can(permissions.PRODUCTS_WRITE)
    .input(
      z.object({
        id: z.uuid(),
        amountPaise: z
          .number()
          .int()
          .refine((n) => n !== 0),
        note: z.string().trim().min(1).max(500),
      }),
    )
    .handler(({ context, input }) =>
      surface(() =>
        changeGiftCardBalance(
          { storeId: context.scope.storeId, tx: context.tx },
          {
            giftCardId: input.id,
            amountPaise: input.amountPaise,
            kind: 'adjustment',
            note: input.note,
            author: context.session.user.email,
          },
        ),
      ),
    ),

  /** Email the code again, to the card's recipient or another address. */
  resend: can(permissions.PRODUCTS_WRITE)
    .input(z.object({ id: z.uuid(), to: z.email().optional() }))
    .handler(({ context, input }) =>
      surface(async () => {
        const ctx = { storeId: context.scope.storeId, tx: context.tx }
        const { notifications } = await storeRegistries(context.tx, context.scope.storeId)
        const channels = await giftCardChannels(ctx, notifications, settingsSecret())
        return deliverGiftCard(ctx, input.id, { channels, secret: settingsSecret(), to: input.to })
      }),
    ),

  products: can(permissions.PRODUCTS_READ).handler(({ context }) =>
    listGiftCardProducts({ storeId: context.scope.storeId, tx: context.tx }),
  ),

  createProduct: can(permissions.PRODUCTS_WRITE)
    .input(
      z.object({
        title: z.string().trim().min(1).max(200),
        denominationsPaise: z.array(z.number().int().positive()).min(1).max(20),
      }),
    )
    .handler(({ context, input }) =>
      surface(() =>
        createGiftCardProduct({ storeId: context.scope.storeId, tx: context.tx }, input),
      ),
    ),

  settings: can(permissions.PRODUCTS_READ).handler(({ context }) =>
    getGiftCardSettings({ storeId: context.scope.storeId, tx: context.tx }),
  ),

  saveSettings: can(permissions.SETTINGS_MANAGE)
    .input(GiftCardSettingsSchema)
    .handler(({ context, input }) =>
      saveGiftCardSettings({ storeId: context.scope.storeId, tx: context.tx }, input),
    ),
}
