import { cart, cartLine, media, product, sellableStock, variant } from '@commerce/db'
import { and, eq } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { CartNotOpen, NotLaunchedYet } from '../errors'
import { isLaunched } from '../preorder/launch'
import { resolvePreorderSettings } from '../preorder/settings'

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
  /** A gift card product: digital, checked out on its own. */
  giftCard: boolean
  /** Sold under pre-order rules; the storefront shows the ship date and badge for this line. */
  preorder: boolean
}

export type CartView = {
  id: string
  status: 'open' | 'converted' | 'abandoned'
  lines: CartLineView[]
  itemCount: number
  subtotalPaise: number
  /** Code the shopper applied; the amount is only ever computed by the discount resolver. */
  discountCode: string | null
}

type AvailabilityRow = {
  trackInventory: boolean
  giftCard: boolean
  onHand: number | null
  reserved: number | null
  preorderOverride: Parameters<typeof resolvePreorderSettings>[1]
  preorderEnabled: boolean
  preorderShipDate: Date | null
  preorderShipsInDays: number | null
  preorderLimit: number | null
  preorderButtonLabel: string
  preorderPaymentMode: 'full' | 'fixed' | 'percentage'
  preorderDepositPaise: number | null
  preorderDepositPercent: number | null
}

/**
 * How many more of this line the shopper can add: real stock, plus pre-order
 * room beyond it (unlimited when the product's `preorderLimit` is null). A
 * hint for the quantity stepper; `placeOrder`'s `reserveStock` is the actual
 * server-side check.
 */
function lineAvailable(r: AvailabilityRow): number {
  if (!r.trackInventory || r.giftCard) return 999
  const stock = Math.max(0, (r.onHand ?? 0) - (r.reserved ?? 0))
  const settings = resolvePreorderSettings(r, r.preorderOverride)
  if (!settings.enabled) return stock
  if (settings.limit == null) return 999
  const committed = Math.max(0, (r.reserved ?? 0) - (r.onHand ?? 0))
  return stock + Math.max(0, settings.limit - committed)
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
      preorder: cartLine.preorder,
      productHandle: product.handle,
      productTitle: product.title,
      variantTitle: variant.title,
      onHand: sellableStock.onHand,
      reserved: sellableStock.reserved,
      trackInventory: variant.trackInventory,
      imageUrl: media.url,
      giftCard: product.isGiftCard,
      preorderOverride: variant.preorderOverride,
      preorderEnabled: product.preorderEnabled,
      preorderShipDate: product.preorderShipDate,
      preorderShipsInDays: product.preorderShipsInDays,
      preorderLimit: product.preorderLimit,
      preorderButtonLabel: product.preorderButtonLabel,
      preorderPaymentMode: product.preorderPaymentMode,
      preorderDepositPaise: product.preorderDepositPaise,
      preorderDepositPercent: product.preorderDepositPercent,
    })
    .from(cartLine)
    .innerJoin(variant, eq(variant.id, cartLine.variantId))
    .innerJoin(product, eq(product.id, variant.productId))
    .leftJoin(sellableStock, eq(sellableStock.variantId, variant.id))
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
    available: lineAvailable(r),
    imageUrl: r.imageUrl,
    giftCard: r.giftCard,
    preorder: r.preorder,
  }))
  return {
    id: c.id,
    status: c.status,
    lines,
    itemCount: lines.reduce((n, l) => n + l.quantity, 0),
    subtotalPaise: lines.reduce((n, l) => n + l.linePaise, 0),
    discountCode: c.discountCode,
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
  const [row] = await ctx.tx
    .select({ variant, product })
    .from(variant)
    .innerJoin(product, eq(product.id, variant.productId))
    .where(eq(variant.id, variantId))
  if (!row) throw new Error(`variant ${variantId} not found`)
  const { variant: v, product: p } = row
  if (!isLaunched(p.launchAt)) throw new NotLaunchedYet(variantId, p.launchAt as Date, ctx.storeId)
  const preorder = resolvePreorderSettings(p, v.preorderOverride).enabled
  const [existing] = await ctx.tx
    .select()
    .from(cartLine)
    .where(and(eq(cartLine.cartId, cartId), eq(cartLine.variantId, variantId)))
  if (existing) {
    await ctx.tx
      .update(cartLine)
      .set({ quantity: existing.quantity + quantity, unitPricePaise: v.pricePaise, preorder })
      .where(eq(cartLine.id, existing.id))
  } else {
    await ctx.tx.insert(cartLine).values({
      storeId: ctx.storeId,
      cartId,
      variantId,
      quantity,
      unitPricePaise: v.pricePaise,
      preorder,
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
