import { z } from 'zod'

export const DiscountKindSchema = z.enum(['code', 'automatic'])
export const DiscountMethodSchema = z.enum(['percent', 'fixed', 'free_shipping'])
export const DiscountAppliesToSchema = z.enum(['all', 'products', 'collections'])
export const DiscountStatusSchema = z.enum(['active', 'disabled'])
/** Shopify's four types: amount off products, amount off order, buy X get Y, free shipping. */
const DiscountTypeSchema = z.enum(['products', 'order', 'bxgy', 'shipping'])
const DiscountEligibilitySchema = z.enum(['all', 'segments', 'customers'])

const DiscountCombinesWithSchema = z.object({
  products: z.boolean().default(false),
  order: z.boolean().default(false),
  shipping: z.boolean().default(false),
})

const scopeSchema = z.object({
  appliesTo: z.enum(['products', 'collections']),
  ids: z.array(z.uuid()).min(1, 'Pick at least one item').max(500),
})

/** Buy X get Y: what the shopper buys, what they get, and a per-order cap. */
const DiscountBxgySchema = z.object({
  buys: scopeSchema.extend({
    kind: z.enum(['quantity', 'amount']),
    quantity: z.number().int().min(0).max(10_000),
    amountPaise: z.number().int().min(0).max(1_000_000_000),
  }),
  gets: scopeSchema.extend({ quantity: z.number().int().min(1).max(10_000) }),
  maxUsesPerOrder: z.number().int().min(1).max(10_000).nullable(),
})

/** Codes: letters, digits and hyphens, stored upper-case. */
export const DiscountCodeSchema = z
  .string()
  .trim()
  .min(2)
  .max(40)
  .regex(/^[A-Za-z0-9-]+$/, 'Use letters, numbers and hyphens only')
  .transform((s) => s.toUpperCase())

const limit = z.number().int().min(1).max(1_000_000).nullable()

const PERCENT_RANGE = 'Percent must be between 0.01 and 100'

/**
 * A per-product discount: product-scoped, percent or fixed, one value above zero for
 * every chosen product and none for products that are not chosen.
 */
function checkProductValues(
  d: { method: string; appliesTo: string; appliesToIds: string[] },
  entries: [string, number][],
  ctx: z.RefinementCtx,
): void {
  const path = ['productValues']
  if (d.appliesTo !== 'products') {
    ctx.addIssue({ code: 'custom', path, message: 'Amounts per product need specific products' })
    return
  }
  if (d.method === 'free_shipping') {
    ctx.addIssue({ code: 'custom', path, message: 'Free shipping has no amount per product' })
    return
  }
  const chosen = new Set(d.appliesToIds)
  for (const [id, value] of entries) {
    if (!chosen.has(id)) {
      ctx.addIssue({ code: 'custom', path: [...path, id], message: 'Product is not chosen' })
    } else if (value < 1) {
      ctx.addIssue({ code: 'custom', path: [...path, id], message: 'Enter an amount' })
    } else if (d.method === 'percent' && value > 10_000) {
      ctx.addIssue({ code: 'custom', path: [...path, id], message: PERCENT_RANGE })
    }
  }
  const valued = new Set(entries.map(([id]) => id))
  for (const id of chosen) {
    if (!valued.has(id)) {
      ctx.addIssue({ code: 'custom', path: [...path, id], message: 'Enter an amount' })
    }
  }
}

/** Each type's own rules: what it gives and what it may point at. */
function checkType(
  d: {
    type?: z.infer<typeof DiscountTypeSchema> | undefined
    method: string
    appliesTo: string
    bxgy?: z.infer<typeof DiscountBxgySchema> | null | undefined
  },
  ctx: z.RefinementCtx,
): void {
  if (d.type === 'shipping' && d.method !== 'free_shipping') {
    ctx.addIssue({ code: 'custom', path: ['method'], message: 'Free shipping gives free shipping' })
  }
  if (d.type && d.type !== 'shipping' && d.method === 'free_shipping') {
    ctx.addIssue({ code: 'custom', path: ['method'], message: 'Pick a percentage or an amount' })
  }
  if (d.type === 'order' && d.appliesTo !== 'all') {
    ctx.addIssue({
      code: 'custom',
      path: ['appliesTo'],
      message: 'Order discounts cover the order',
    })
  }
  if (d.type === 'products' && d.appliesTo === 'all') {
    ctx.addIssue({ code: 'custom', path: ['appliesTo'], message: 'Pick products or collections' })
  }
  if (d.type === 'bxgy') {
    if (!d.bxgy) {
      ctx.addIssue({ code: 'custom', path: ['bxgy'], message: 'Say what shoppers buy and get' })
    } else if (
      d.bxgy.buys.kind === 'quantity' ? d.bxgy.buys.quantity < 1 : d.bxgy.buys.amountPaise < 1
    ) {
      ctx.addIssue({ code: 'custom', path: ['bxgy', 'buys'], message: 'Enter what shoppers buy' })
    }
  }
}

export const DiscountInputSchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    /** Left out by older callers: derived from `method` and `appliesTo` on save. */
    type: DiscountTypeSchema.optional(),
    kind: DiscountKindSchema,
    code: DiscountCodeSchema.nullable().optional(),
    method: DiscountMethodSchema,
    /** Basis points for percent (100 = 1%), paise for fixed, ignored for free shipping. */
    value: z.number().int().min(0).max(100_000_000),
    minSubtotalPaise: z.number().int().min(0).max(1_000_000_000).nullable().optional(),
    /** Minimum number of items; Shopify offers it instead of a minimum amount. */
    minQuantity: z.number().int().min(1).max(10_000).nullable().optional(),
    appliesTo: DiscountAppliesToSchema.default('all'),
    appliesToIds: z.array(z.uuid()).max(500).default([]),
    /**
     * A different amount per product, `{ productId: value }` in the same unit as `value`,
     * taken off each unit. Only with `appliesTo: 'products'`; null or empty keeps `value`.
     */
    productValues: z
      .record(z.uuid(), z.number().int().min(0).max(100_000_000))
      .refine((m) => Object.keys(m).length <= 500, 'At most 500 products')
      .nullable()
      .optional(),
    bxgy: DiscountBxgySchema.nullable().optional(),
    /** Free shipping: only to these state codes (empty: every state). */
    shippingStates: z.array(z.string().trim().min(2).max(3)).max(40).default([]),
    /** Free shipping: rates above this price are charged in full. */
    maxShippingPaise: z.number().int().min(0).max(100_000_000).nullable().optional(),
    customerEligibility: DiscountEligibilitySchema.default('all'),
    /** Segment ids or customer ids, per `customerEligibility`. */
    eligibleIds: z.array(z.uuid()).max(500).default([]),
    combinesWith: DiscountCombinesWithSchema.default({
      products: false,
      order: false,
      shipping: false,
    }),
    usageLimit: limit.optional(),
    usagePerCustomer: limit.optional(),
    startsAt: z.coerce.date().nullable().optional(),
    endsAt: z.coerce.date().nullable().optional(),
    status: DiscountStatusSchema.default('active'),
  })
  .superRefine((d, ctx) => {
    if (d.kind === 'code' && !d.code) {
      ctx.addIssue({ code: 'custom', path: ['code'], message: 'A discount code needs a code' })
    }
    const perProduct = d.productValues ? Object.entries(d.productValues) : []
    if (perProduct.length > 0) {
      checkProductValues(d, perProduct, ctx)
    } else {
      if (d.method === 'percent' && (d.value < 1 || d.value > 10_000)) {
        ctx.addIssue({ code: 'custom', path: ['value'], message: PERCENT_RANGE })
      }
      if (d.method === 'fixed' && d.value < 1) {
        ctx.addIssue({ code: 'custom', path: ['value'], message: 'Enter an amount' })
      }
    }
    if (d.appliesTo !== 'all' && d.appliesToIds.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['appliesToIds'], message: 'Pick at least one item' })
    }
    if (d.startsAt && d.endsAt && d.endsAt <= d.startsAt) {
      ctx.addIssue({ code: 'custom', path: ['endsAt'], message: 'End must be after start' })
    }
    checkType(d, ctx)
    if (d.customerEligibility !== 'all' && d.eligibleIds.length === 0) {
      const message =
        d.customerEligibility === 'segments'
          ? 'Pick at least one segment'
          : 'Pick at least one customer'
      ctx.addIssue({ code: 'custom', path: ['eligibleIds'], message })
    }
    if (d.minSubtotalPaise != null && d.minQuantity != null) {
      ctx.addIssue({
        code: 'custom',
        path: ['minQuantity'],
        message: 'Use a minimum amount or a minimum quantity, not both',
      })
    }
  })

export type DiscountInput = z.infer<typeof DiscountInputSchema>
