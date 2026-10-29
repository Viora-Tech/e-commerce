import {
  product,
  productOption,
  productOptionValue,
  store,
  variant,
  variantOptionValue,
} from '@commerce/db'
import { formatMoney } from '@commerce/money'
import { and, asc, eq, inArray, isNull } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { GIFT_CARD_MAX_VALUE_PAISE, type GiftCardSettings, GiftCardSettingsSchema } from './client'
import { GiftCardError } from './service'

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'gift-card'

const rupees = (paise: number) => formatMoney(paise, 'INR')

/**
 * Create a gift card product the way Shopify does: one "Denomination" option
 * with a variant per value. Variants are untracked (a card never runs out),
 * untaxed at sale, and weigh nothing. The product starts as a draft so the
 * merchant can add an image before it goes on sale.
 */
export async function createGiftCardProduct(
  ctx: StoreContext,
  input: { title: string; denominationsPaise: readonly number[] },
): Promise<{ id: string }> {
  const title = input.title.trim()
  if (!title) throw new GiftCardError('invalid', 'Give the gift card product a title')
  const values = [...new Set(input.denominationsPaise)].sort((a, b) => a - b)
  if (values.length === 0) throw new GiftCardError('invalid', 'Add at least one denomination')
  if (values.some((v) => !Number.isInteger(v) || v <= 0 || v > GIFT_CARD_MAX_VALUE_PAISE)) {
    throw new GiftCardError('invalid', 'Denominations are between ₹1 and ₹2,00,000')
  }
  let handle = slug(title)
  const taken = await ctx.tx
    .select({ handle: product.handle })
    .from(product)
    .where(eq(product.storeId, ctx.storeId))
  const handles = new Set(taken.map((t) => t.handle))
  for (let n = 2; handles.has(handle); n++) handle = `${slug(title)}-${n}`

  const [p] = await ctx.tx
    .insert(product)
    .values({
      storeId: ctx.storeId,
      handle,
      title,
      productType: 'Gift card',
      status: 'draft',
      isGiftCard: true,
      taxIncluded: true,
    })
    .returning({ id: product.id })
  if (!p) throw new Error('product insert returned nothing')
  const [opt] = await ctx.tx
    .insert(productOption)
    .values({ storeId: ctx.storeId, productId: p.id, name: 'Denomination', position: 0 })
    .returning({ id: productOption.id })
  if (!opt) throw new Error('option insert returned nothing')
  for (const [i, value] of values.entries()) {
    const label = rupees(value)
    const [ov] = await ctx.tx
      .insert(productOptionValue)
      .values({ storeId: ctx.storeId, optionId: opt.id, value: label, position: i })
      .returning({ id: productOptionValue.id })
    const [v] = await ctx.tx
      .insert(variant)
      .values({
        storeId: ctx.storeId,
        productId: p.id,
        title: label,
        pricePaise: value,
        taxable: false,
        trackInventory: false,
        weightGrams: 0,
        position: i,
      })
      .returning({ id: variant.id })
    if (!ov || !v) throw new Error('variant insert returned nothing')
    await ctx.tx
      .insert(variantOptionValue)
      .values({ storeId: ctx.storeId, variantId: v.id, optionValueId: ov.id })
  }
  return { id: p.id }
}

/** Gift card products with their live denominations, for the gift cards page. */
export async function listGiftCardProducts(ctx: StoreContext) {
  const products = await ctx.tx
    .select({
      id: product.id,
      title: product.title,
      status: product.status,
      handle: product.handle,
    })
    .from(product)
    .where(eq(product.isGiftCard, true))
    .orderBy(asc(product.title))
  if (products.length === 0) return []
  const variants = await ctx.tx
    .select({ productId: variant.productId, pricePaise: variant.pricePaise })
    .from(variant)
    .where(
      and(
        inArray(
          variant.productId,
          products.map((p) => p.id),
        ),
        isNull(variant.archivedAt),
      ),
    )
    .orderBy(asc(variant.pricePaise))
  return products.map((p) => ({
    ...p,
    denominationsPaise: variants.flatMap((v) =>
      v.productId === p.id && v.pricePaise != null ? [v.pricePaise] : [],
    ),
  }))
}

export async function getGiftCardSettings(ctx: StoreContext): Promise<GiftCardSettings> {
  const [s] = await ctx.tx
    .select({ giftCards: store.giftCards })
    .from(store)
    .where(eq(store.id, ctx.storeId))
  const parsed = GiftCardSettingsSchema.safeParse(s?.giftCards ?? {})
  return parsed.success ? parsed.data : { expiryMonths: null }
}

export async function saveGiftCardSettings(
  ctx: StoreContext,
  input: GiftCardSettings,
): Promise<GiftCardSettings> {
  const settings = GiftCardSettingsSchema.parse(input)
  await ctx.tx.update(store).set({ giftCards: settings }).where(eq(store.id, ctx.storeId))
  return settings
}
