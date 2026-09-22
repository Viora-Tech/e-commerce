import { z } from 'zod'

export const DiscountKindSchema = z.enum(['code', 'automatic'])
export const DiscountMethodSchema = z.enum(['percent', 'fixed', 'free_shipping'])
export const DiscountAppliesToSchema = z.enum(['all', 'products', 'collections'])
export const DiscountStatusSchema = z.enum(['active', 'disabled'])

/** Codes: letters, digits and hyphens, stored upper-case. */
export const DiscountCodeSchema = z
  .string()
  .trim()
  .min(2)
  .max(40)
  .regex(/^[A-Za-z0-9-]+$/, 'Use letters, numbers and hyphens only')
  .transform((s) => s.toUpperCase())

const limit = z.number().int().min(1).max(1_000_000).nullable()

export const DiscountInputSchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    kind: DiscountKindSchema,
    code: DiscountCodeSchema.nullable().optional(),
    method: DiscountMethodSchema,
    /** Basis points for percent (100 = 1%), paise for fixed, ignored for free shipping. */
    value: z.number().int().min(0).max(100_000_000),
    minSubtotalPaise: z.number().int().min(0).max(1_000_000_000).nullable().optional(),
    appliesTo: DiscountAppliesToSchema.default('all'),
    appliesToIds: z.array(z.uuid()).max(500).default([]),
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
    if (d.method === 'percent' && (d.value < 1 || d.value > 10_000)) {
      ctx.addIssue({
        code: 'custom',
        path: ['value'],
        message: 'Percent must be between 0.01 and 100',
      })
    }
    if (d.method === 'fixed' && d.value < 1) {
      ctx.addIssue({ code: 'custom', path: ['value'], message: 'Enter an amount' })
    }
    if (d.appliesTo !== 'all' && d.appliesToIds.length === 0) {
      ctx.addIssue({ code: 'custom', path: ['appliesToIds'], message: 'Pick at least one item' })
    }
    if (d.startsAt && d.endsAt && d.endsAt <= d.startsAt) {
      ctx.addIssue({ code: 'custom', path: ['endsAt'], message: 'End must be after start' })
    }
  })

export type DiscountInput = z.infer<typeof DiscountInputSchema>
