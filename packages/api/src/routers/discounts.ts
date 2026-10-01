import { DiscountInputSchema, permissions } from '@commerce/core'
import { ORPCError } from '@orpc/server'
import { z } from 'zod'
import { can, PAGE_SIZE_MAX, SEARCH_MAX } from '../procedures'
import {
  createDiscount,
  DiscountCodeTaken,
  deleteDiscount,
  discountStats,
  getDiscount,
  listDiscounts,
  setDiscountStatus,
  updateDiscount,
} from '../services/discount.service'

const LIFECYCLES = ['active', 'scheduled', 'expired', 'disabled'] as const

function surfaceCodeClash<T>(work: () => Promise<T>): Promise<T> {
  return work().catch((err: unknown) => {
    if (err instanceof DiscountCodeTaken) {
      throw new ORPCError('CONFLICT', { message: err.message })
    }
    throw err
  })
}

export const discountsRouter = {
  list: can(permissions.DISCOUNTS_READ)
    .input(
      z.object({
        page: z.number().int().min(1).default(1),
        perPage: z.number().int().min(1).max(PAGE_SIZE_MAX).default(25),
        search: z.string().trim().max(SEARCH_MAX).optional(),
        lifecycle: z.enum(LIFECYCLES).optional(),
      }),
    )
    .handler(({ context, input }) => listDiscounts(context.tx, input)),

  stats: can(permissions.DISCOUNTS_READ).handler(({ context }) => discountStats(context.tx)),

  get: can(permissions.DISCOUNTS_READ)
    .input(z.object({ id: z.uuid() }))
    .handler(({ context, input }) => getDiscount(context.tx, input.id)),

  create: can(permissions.DISCOUNTS_WRITE)
    .input(DiscountInputSchema)
    .handler(({ context, input }) =>
      surfaceCodeClash(() => createDiscount(context.tx, context.scope.storeId, input)),
    ),

  update: can(permissions.DISCOUNTS_WRITE)
    .input(z.object({ id: z.uuid(), data: DiscountInputSchema }))
    .handler(({ context, input }) =>
      surfaceCodeClash(() =>
        updateDiscount(context.tx, context.scope.storeId, input.id, input.data),
      ),
    ),

  toggle: can(permissions.DISCOUNTS_WRITE)
    .input(z.object({ id: z.uuid(), status: z.enum(['active', 'disabled']) }))
    .handler(({ context, input }) => setDiscountStatus(context.tx, input.id, input.status)),

  delete: can(permissions.DISCOUNTS_WRITE)
    .input(z.object({ id: z.uuid() }))
    .handler(({ context, input }) => deleteDiscount(context.tx, input.id)),
}
