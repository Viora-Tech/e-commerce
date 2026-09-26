/** SOURCE OF TRUTH: payment test order — WHAT the ₹1 "Place a test order" basket is / WHY a merchant can try their checkout end to end without touching a real product */
import { product, variant } from '@commerce/db'
import { and, eq } from 'drizzle-orm'
import { addToCart, createCart } from '../cart/cart'
import type { StoreContext } from '../context'

/** Handle of the hidden test product; a draft, so shoppers never see it in the store. */
const PAYMENT_TEST_HANDLE = 'payment-test'
const PAYMENT_TEST_PRICE_PAISE = 100

/**
 * The ₹1 test product, created on first use. It stays a draft and is flagged
 * `isSystemTest`, so it never appears in listings, search, collections,
 * storefront surfaces, analytics or inventory — see `notSystemTest` in
 * `@commerce/core`. It does not track stock, so a test order never
 * touches real inventory. Carts and direct-id lookups ignore the flag, so the
 * "Place a test order" checkout flow still works.
 */
async function ensurePaymentTestProduct(ctx: StoreContext): Promise<string> {
  const [existing] = await ctx.tx
    .select({ variantId: variant.id })
    .from(variant)
    .innerJoin(product, eq(product.id, variant.productId))
    .where(and(eq(product.handle, PAYMENT_TEST_HANDLE), eq(product.storeId, ctx.storeId)))
    .limit(1)
  if (existing) {
    // Products created before the flag existed stay hidden once this runs again.
    await ctx.tx
      .update(product)
      .set({ isSystemTest: true })
      .where(
        and(
          eq(product.handle, PAYMENT_TEST_HANDLE),
          eq(product.storeId, ctx.storeId),
          eq(product.isSystemTest, false),
        ),
      )
    return existing.variantId
  }
  const [p] = await ctx.tx
    .insert(product)
    .values({
      storeId: ctx.storeId,
      handle: PAYMENT_TEST_HANDLE,
      title: 'Payment test (₹1)',
      status: 'draft',
      tags: ['payment-test'],
      vendor: 'Settings → Payments',
      isSystemTest: true,
    })
    .returning({ id: product.id })
  if (!p) throw new Error('test product insert returned nothing')
  const [v] = await ctx.tx
    .insert(variant)
    .values({
      storeId: ctx.storeId,
      productId: p.id,
      title: 'Default',
      sku: 'PAYMENT-TEST',
      pricePaise: PAYMENT_TEST_PRICE_PAISE,
      trackInventory: false,
      taxable: false,
      weightGrams: 10,
    })
    .returning({ id: variant.id })
  if (!v) throw new Error('test variant insert returned nothing')
  return v.id
}

/** A fresh basket holding just the ₹1 test product; the caller turns its id into a signed link. */
export async function createPaymentTestCart(ctx: StoreContext): Promise<string> {
  const variantId = await ensurePaymentTestProduct(ctx)
  const cartId = await createCart(ctx)
  await addToCart(ctx, cartId, variantId, 1)
  return cartId
}
