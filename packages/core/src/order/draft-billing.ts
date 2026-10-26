/** SOURCE OF TRUTH: draft order addresses — WHAT: the shipping and billing address parts a draft takes, and writing them as order snapshots (a separate billing address with its company and checked GSTIN, or none when billing is the shipping address) / WHY: draft orders bill like checkout: one snapshot table, the GST invoice reads the buyer's GSTIN from the order, and the place of supply stays the shipping state */
import { address } from '@commerce/db'
import { z } from 'zod'
import type { StoreContext } from '../context'
import { CommerceError } from '../errors'
import { GSTIN_MESSAGES, validateGstin } from '../tax/gstin'

export const DraftAddressSchema = z.object({
  name: z.string().trim().min(1).max(120),
  line1: z.string().trim().min(1).max(200),
  line2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(1).max(120),
  stateCode: z.string().trim().min(2).max(3),
  pincode: z
    .string()
    .trim()
    .regex(/^\d{6}$/),
  phone: z.string().trim().min(6).max(20),
})

/**
 * Where the bill goes when it is not the shipping address: the same parts, plus the company
 * and its GSTIN for a GST invoice (both optional; the GSTIN is checked with `validateGstin`).
 */
export const DraftBillingSchema = DraftAddressSchema.extend({
  businessName: z.string().trim().max(200).nullish(),
  gstin: z.string().trim().max(20).nullish(),
})

/** A GSTIN on a draft's billing address that fails `validateGstin`. The message is shown as is. */
export class DraftInvalidGstin extends CommerceError {
  constructor(message: string, storeId?: string) {
    super('DRAFT_INVALID_GSTIN', message, { storeId })
  }
}

export async function writeAddress(
  ctx: StoreContext,
  a: z.infer<typeof DraftAddressSchema> | null | undefined,
): Promise<string | null> {
  if (!a) return null
  const [row] = await ctx.tx
    .insert(address)
    .values({
      storeId: ctx.storeId,
      name: a.name,
      line1: a.line1,
      line2: a.line2 ?? null,
      city: a.city,
      stateCode: a.stateCode,
      pincode: a.pincode,
      phone: a.phone,
    })
    .returning({ id: address.id })
  return row?.id ?? null
}

type BillingColumns = {
  billingAddressId: string | null
  buyerGstin: string | null
  buyerBusinessName: string | null
}

/**
 * The draft's billing columns from its input: none when billing is the shipping address, a new
 * snapshot (and the GSTIN the GST invoice bills) when a billing address is given, and undefined
 * (keep what the draft has) when the input says neither.
 */
export async function writeBilling(
  ctx: StoreContext,
  input: {
    billingSameAsShipping?: boolean | undefined
    billing?: z.infer<typeof DraftBillingSchema> | null | undefined
  },
): Promise<BillingColumns | undefined> {
  if (input.billingSameAsShipping) {
    return { billingAddressId: null, buyerGstin: null, buyerBusinessName: null }
  }
  if (!input.billing) return undefined
  let gstin: string | null = null
  if (input.billing.gstin) {
    const check = validateGstin(input.billing.gstin)
    if (!check.ok) {
      throw new DraftInvalidGstin(
        GSTIN_MESSAGES[check.reason as keyof typeof GSTIN_MESSAGES] ?? GSTIN_MESSAGES.shape,
        ctx.storeId,
      )
    }
    gstin = check.gstin
  }
  return {
    billingAddressId: await writeAddress(ctx, input.billing),
    buyerGstin: gstin,
    // The company the GST invoice bills (with or without a GSTIN).
    buyerBusinessName: input.billing.businessName || null,
  }
}
