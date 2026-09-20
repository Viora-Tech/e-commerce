import { cart, cartLine, inventoryLevel, media, product, variant } from '@commerce/db'
import { and, eq } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { CartNotOpen } from '../errors'

export type CartLineView = {
  id: string
  variantId: string
  productHandle: string
  productTitle: string
  variantTitle: string
  quantity: number
  unitPricePaise: number
  linePaise: number
  available: number
  imageUrl: string | null
}

export type CartView = {
  id: string
  status: 'open' | 'converted' | 'abandoned'
  lines: CartLineView[]
  itemCount: number
  subtotalPaise: number
}

export async function createCart(ctx: StoreContext): Promise<string> {
  const [c] = await ctx.tx.insert(cart).values({ storeId: ctx.storeId }).returning({ id: cart.id })
  if (!c) throw new Error('cart insert returned nothing')
  return c.id
}

export async function getCart(ctx: StoreContext, cartId: string): Promise<CartView | null> {
  const [c] = await ctx.tx.select().from(cart).where(eq(cart.id, cartId))
  if (!c) return null
  const rows = await ctx.tx
    .select({
      id: cartLine.id,
      variantId: cartLine.variantId,
      quantity: cartLine.quantity,
      unitPricePaise: cartLine.unitPricePaise,
      productHandle: product.handle,
      productTitle: product.title,
      variantTitle: variant.title,
      onHand: inventoryLevel.onHand,
      reserved: inventoryLevel.reserved,
      imageUrl: media.url,
    })
    .from(cartLine)
    .innerJoin(variant, eq(variant.id, cartLine.variantId))
    .innerJoin(product, eq(product.id, variant.productId))
    .leftJoin(inventoryLevel, eq(inventoryLevel.variantId, variant.id))
    .leftJoin(media, eq(media.id, variant.mediaId))
    .where(eq(cartLine.cartId, cartId))
  const lines: CartLineView[] = rows.map((r) => ({
    id: r.id,
    variantId: r.variantId,
    productHandle: r.productHandle,
    productTitle: r.productTitle,
    variantTitle: r.variantTitle,
    quantity: r.quantity,
    unitPricePaise: r.unitPricePaise,
    linePaise: r.quantity * r.unitPricePaise,
    available: Math.max(0, (r.onHand ?? 0) - (r.reserved ?? 0)),
    imageUrl: r.imageUrl,
  }))
  return {
    id: c.id,
    status: c.status,
    lines,
    itemCount: lines.reduce((n, l) => n + l.quantity, 0),
    subtotalPaise: lines.reduce((n, l) => n + l.linePaise, 0),
  }
}

/** Add a variant, merging into an existing line. Price is snapshotted from the variant now. */
export async function addToCart(
  ctx: StoreContext,
  cartId: string,
  variantId: string,
  quantity = 1,
): Promise<void> {
  const [c] = await ctx.tx.select().from(cart).where(eq(cart.id, cartId))
  if (c?.status !== 'open') throw new CartNotOpen(cartId, ctx.storeId)
  const [v] = await ctx.tx.select().from(variant).where(eq(variant.id, variantId))
  if (!v) throw new Error(`variant ${variantId} not found`)
  const [existing] = await ctx.tx
    .select()
    .from(cartLine)
    .where(and(eq(cartLine.cartId, cartId), eq(cartLine.variantId, variantId)))
  if (existing) {
    await ctx.tx
      .update(cartLine)
      .set({ quantity: existing.quantity + quantity, unitPricePaise: v.pricePaise })
      .where(eq(cartLine.id, existing.id))
  } else {
    await ctx.tx.insert(cartLine).values({
      storeId: ctx.storeId,
      cartId,
      variantId,
      quantity,
      unitPricePaise: v.pricePaise,
    })
  }
}

export async function setLineQuantity(
  ctx: StoreContext,
  cartId: string,
  lineId: string,
  quantity: number,
): Promise<void> {
  if (quantity <= 0) {
    await ctx.tx.delete(cartLine).where(and(eq(cartLine.id, lineId), eq(cartLine.cartId, cartId)))
    return
  }
  await ctx.tx
    .update(cartLine)
    .set({ quantity })
    .where(and(eq(cartLine.id, lineId), eq(cartLine.cartId, cartId)))
}
