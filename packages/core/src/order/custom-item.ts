/** SOURCE OF TRUTH: draft custom items — WHAT the hidden "Custom item" product every one-off draft line (not in the catalogue) is booked against / WHY order lines need a variant, and a merchant selling a one-off (an alteration, a bundle priced by hand) must not have to create a product first */
import { product, variant } from '@commerce/db'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import type { StoreContext } from '../context'
import { CommerceError } from '../errors'

/**
 * Handle of the hidden product. Product handles typed in the admin are slugs, which never start
 * with an underscore, so a merchant's own product cannot take it.
 */
export const CUSTOM_ITEM_HANDLE = '__custom-item'

/** HSN codes are 4, 6 or 8 digits (the same rule as Settings → Taxes). */
const HSN = /^[0-9]{4}([0-9]{2}){0,2}$/

/** A one-off line on a draft: its own title and price, taxed at the store rate unless untaxed. */
export const CustomItemSchema = z.object({
  title: z.string().trim().min(1).max(200),
  /** False: no GST on this line (an exempt service, a deposit). */
  taxable: z.boolean().default(true),
  hsCode: z
    .string()
    .trim()
    .refine((v) => v === '' || HSN.test(v), 'HSN codes are 4, 6 or 8 digits')
    .nullish(),
})
export type CustomItem = z.infer<typeof CustomItemSchema>

/**
 * The "Custom item" product, created on first use. Like the payments test product it is
 * flagged `isSystemTest` (hidden from every listing, search, collection, storefront surface and
 * report on products) and archived, so "Duplicate order" skips it rather than repricing it.
 * Its variant tracks no stock, so routing never reserves or counts anything for it. Each line
 * keeps its own title, price and GST rate as order line snapshots.
 */
export async function ensureCustomItemVariant(ctx: StoreContext): Promise<string> {
  const [existing] = await ctx.tx
    .select({ variantId: variant.id })
    .from(variant)
    .innerJoin(product, eq(product.id, variant.productId))
    .where(
      and(
        eq(product.storeId, ctx.storeId),
        eq(product.handle, CUSTOM_ITEM_HANDLE),
        eq(product.isSystemTest, true),
      ),
    )
    .limit(1)
  if (existing) return existing.variantId
  const [p] = await ctx.tx
    .insert(product)
    .values({
      storeId: ctx.storeId,
      handle: CUSTOM_ITEM_HANDLE,
      title: 'Custom item',
      status: 'archived',
      tags: ['custom-item'],
      isSystemTest: true,
    })
    .returning({ id: product.id })
  if (!p)
    throw new CommerceError('CUSTOM_ITEM_INSERT_FAILED', 'custom item insert returned nothing')
  const [v] = await ctx.tx
    .insert(variant)
    .values({
      storeId: ctx.storeId,
      productId: p.id,
      title: 'Default',
      pricePaise: null,
      trackInventory: false,
      hiddenOnStore: true,
    })
    .returning({ id: variant.id })
  if (!v)
    throw new CommerceError('CUSTOM_ITEM_INSERT_FAILED', 'custom item insert returned nothing')
  return v.id
}
