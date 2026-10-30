import {
  cart,
  cartLine,
  media,
  product,
  productMedia,
  sellableStock,
  store,
  variant,
} from '@commerce/db'
import { and, asc, eq, inArray, ne } from 'drizzle-orm'
import { type CartLimit, lineRoom, productCartLimit } from '../checkout/cart-limit'
import { parseCheckoutSettings } from '../checkout/settings'
import type { StoreContext } from '../context'
import {
  CartLimitExceeded,
  CartNotOpen,
  NotLaunchedYet,
  NotSoldInMarket,
  OutOfStock,
  PriceNotSet,
  VariantHidden,
} from '../errors'
import { unsoldInMarket } from '../markets/catalogs'
import { isLaunched } from '../preorder/launch'
import { preorderNoteText } from '../preorder/note'
import { resolvePreorderSettings, resolveShipDate } from '../preorder/settings'
import { parsePreorderStoreSettings } from '../preorder/store-settings'

export type CartLineView = {
  id: string
  variantId: string
  /** The product the variant belongs to (payment rules by product, #150). */
  productId?: string | undefined
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
  /** The pre-order note (#936), ship date filled in; null when the line is no pre-order or has none. */
  preorderNote?: string | null | undefined
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

/**
 * The most of a variant one cart line may hold while it sells on pre-order with a limit (#939):
 * the stock left plus the pre-order room. Null when nothing caps it here (no pre-order, no limit,
 * untracked or a gift card); `placeOrder`'s reservation still checks plain stock.
 */
async function preorderCap(ctx: StoreContext, variantId: string): Promise<number | null> {
  const [r] = await ctx.tx
    .select({
      trackInventory: variant.trackInventory,
      giftCard: product.isGiftCard,
      onHand: sellableStock.onHand,
      reserved: sellableStock.reserved,
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
    .from(variant)
    .innerJoin(product, eq(product.id, variant.productId))
    .leftJoin(sellableStock, eq(sellableStock.variantId, variant.id))
    .where(eq(variant.id, variantId))
  if (!r?.trackInventory || r.giftCard) return null
  const settings = resolvePreorderSettings(r, r.preorderOverride)
  if (!settings.enabled || settings.limit == null) return null
  return lineAvailable(r)
}

/** Settings → Checkout → Cart limit (#156). */
async function storeCartLimit(ctx: StoreContext): Promise<CartLimit> {
  const [s] = await ctx.tx
    .select({ preferences: store.preferences })
    .from(store)
    .where(eq(store.id, ctx.storeId))
  return parseCheckoutSettings(s?.preferences).cartLimit
}

/** Units of this product the cart holds on lines other than this variant's. */
async function otherLinesOfProduct(
  ctx: StoreContext,
  cartId: string,
  productId: string,
  variantId: string,
): Promise<number> {
  const rows = await ctx.tx
    .select({ quantity: cartLine.quantity })
    .from(cartLine)
    .innerJoin(variant, eq(variant.id, cartLine.variantId))
    .where(
      and(
        eq(cartLine.cartId, cartId),
        eq(variant.productId, productId),
        ne(cartLine.variantId, variantId),
      ),
    )
  return rows.reduce((n, r) => n + r.quantity, 0)
}

/**
 * How many units this variant's line may hold under the cart limit; null when the product has
 * none (or is a gift card).
 */
async function limitRoom(
  ctx: StoreContext,
  cartId: string,
  line: { productId: string; variantId: string; giftCard: boolean },
): Promise<number | null> {
  if (line.giftCard) return null
  const limit = await storeCartLimit(ctx)
  if (productCartLimit(limit, line.productId) === null) return null
  const others = await otherLinesOfProduct(ctx, cartId, line.productId, line.variantId)
  return lineRoom(limit, line.productId, others)
}

export async function createCart(ctx: StoreContext): Promise<string> {
  const [c] = await ctx.tx.insert(cart).values({ storeId: ctx.storeId }).returning({ id: cart.id })
  if (!c) throw new Error('cart insert returned nothing')
  return c.id
}

/**
 * Each product's first image, for lines whose variant has no image of its own (most imported
 * single-variant products): the cart, drawer and checkout show it like Shopify does.
 */
export async function productFirstImages(
  ctx: StoreContext,
  productIds: string[],
): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  if (productIds.length === 0) return out
  const rows = await ctx.tx
    .select({ productId: productMedia.productId, url: media.url })
    .from(productMedia)
    .innerJoin(media, eq(media.id, productMedia.mediaId))
    .where(inArray(productMedia.productId, [...new Set(productIds)]))
    .orderBy(asc(productMedia.position))
  for (const r of rows) if (!out.has(r.productId)) out.set(r.productId, r.url)
  return out
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
      productId: product.id,
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
      preorderNote: product.preorderNote,
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
  const firstImages = await productFirstImages(
    ctx,
    rows.filter((r) => !r.imageUrl).map((r) => r.productId),
  )
  const storeNote = rows.some((r) => r.preorder)
    ? parsePreorderStoreSettings(
        (
          await ctx.tx
            .select({ preorder: store.preorder })
            .from(store)
            .where(eq(store.id, ctx.storeId))
        )[0]?.preorder,
      ).note
    : null
  const noteOf = (r: (typeof rows)[number]) =>
    r.preorder
      ? preorderNoteText({
          productNote: r.preorderNote,
          storeNote,
          shipDate: resolveShipDate(resolvePreorderSettings(r, r.preorderOverride)),
        })
      : null
  // Cart limit (#156): the stepper stops at what the store allows of each product.
  const limit = rows.length > 0 ? await storeCartLimit(ctx) : null
  const roomOf = (r: (typeof rows)[number]) => {
    if (!limit || r.giftCard) return null
    const others = rows.reduce(
      (n, x) => (x.productId === r.productId && x.id !== r.id ? n + x.quantity : n),
      0,
    )
    return lineRoom(limit, r.productId, others)
  }
  const lines: CartLineView[] = rows.map((r) => ({
    id: r.id,
    variantId: r.variantId,
    productId: r.productId,
    productHandle: r.productHandle,
    productTitle: r.productTitle,
    variantTitle: r.variantTitle,
    quantity: r.quantity,
    unitPricePaise: r.unitPricePaise,
    linePaise: r.quantity * r.unitPricePaise,
    available: Math.min(lineAvailable(r), roomOf(r) ?? Number.POSITIVE_INFINITY),
    imageUrl: r.imageUrl ?? firstImages.get(r.productId) ?? null,
    giftCard: r.giftCard,
    preorder: r.preorder,
    preorderNote: noteOf(r),
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

/**
 * Add a variant, merging into an existing line. Price is snapshotted from the variant now.
 * `marketId` is the storefront's market for this request: the cart keeps it, and a market whose
 * catalog leaves the product out refuses it (Markets › Catalogs).
 */
export async function addToCart(
  ctx: StoreContext,
  cartId: string,
  variantId: string,
  quantity = 1,
  options: { marketId?: string | null | undefined } = {},
): Promise<void> {
  const [c] = await ctx.tx.select().from(cart).where(eq(cart.id, cartId))
  if (c?.status !== 'open') throw new CartNotOpen(cartId, ctx.storeId)
  const marketId = options.marketId ?? c.marketId
  const [row] = await ctx.tx
    .select({ variant, product })
    .from(variant)
    .innerJoin(product, eq(product.id, variant.productId))
    .where(eq(variant.id, variantId))
  if (!row) throw new Error(`variant ${variantId} not found`)
  const { variant: v, product: p } = row
  if (v.hiddenOnStore) throw new VariantHidden(variantId, ctx.storeId)
  if ((await unsoldInMarket(ctx.tx, marketId, [p.id])).length > 0) {
    throw new NotSoldInMarket(variantId, ctx.storeId)
  }
  if (options.marketId && options.marketId !== c.marketId) {
    await ctx.tx.update(cart).set({ marketId: options.marketId }).where(eq(cart.id, cartId))
  }
  if (!isLaunched(p.launchAt)) throw new NotLaunchedYet(variantId, p.launchAt as Date, ctx.storeId)
  // Listed before its price was confirmed (#913): on show, never sold, so no ₹0 line.
  const unitPricePaise = v.pricePaise
  if (unitPricePaise == null) throw new PriceNotSet(variantId, ctx.storeId)
  const preorder = resolvePreorderSettings(p, v.preorderOverride).enabled
  // Sold out and not on pre-order (the product has none, or this variant does not allow it,
  // #962): the product page crosses it out, and the cart refuses it too.
  if (!preorder && v.trackInventory && !p.isGiftCard) {
    const [stock] = await ctx.tx
      .select({ onHand: sellableStock.onHand, reserved: sellableStock.reserved })
      .from(sellableStock)
      .where(eq(sellableStock.variantId, variantId))
    if (Math.max(0, (stock?.onHand ?? 0) - (stock?.reserved ?? 0)) < 1) {
      throw new OutOfStock(variantId, ctx.storeId)
    }
  }
  const [existing] = await ctx.tx
    .select()
    .from(cartLine)
    .where(and(eq(cartLine.cartId, cartId), eq(cartLine.variantId, variantId)))
  // A pre-order with a limit holds no more than the stock and pre-order room left (#939).
  const cap = preorder ? await preorderCap(ctx, variantId) : null
  const wanted = (existing?.quantity ?? 0) + quantity
  const capped = cap === null ? wanted : Math.min(wanted, cap)
  // Cart limit (#156): never more of one product than the store allows per cart.
  const room = await limitRoom(ctx, cartId, { productId: p.id, variantId, giftCard: p.isGiftCard })
  const next = room === null ? capped : Math.min(capped, room)
  if (room !== null && next < 1 && !existing) {
    const max = productCartLimit(await storeCartLimit(ctx), p.id) ?? 0
    throw new CartLimitExceeded(p.id, p.title, max, ctx.storeId)
  }
  if (existing) {
    // Already at the limit: the line stays as it is.
    await ctx.tx
      .update(cartLine)
      .set({ quantity: Math.max(existing.quantity, next), unitPricePaise, preorder })
      .where(eq(cartLine.id, existing.id))
  } else {
    if (next < 1) throw new OutOfStock(variantId, ctx.storeId)
    await ctx.tx.insert(cartLine).values({
      storeId: ctx.storeId,
      cartId,
      variantId,
      quantity: next,
      unitPricePaise,
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
  const [line] = await ctx.tx
    .select({
      variantId: cartLine.variantId,
      preorder: cartLine.preorder,
      productId: variant.productId,
      giftCard: product.isGiftCard,
    })
    .from(cartLine)
    .innerJoin(variant, eq(variant.id, cartLine.variantId))
    .innerJoin(product, eq(product.id, variant.productId))
    .where(and(eq(cartLine.id, lineId), eq(cartLine.cartId, cartId)))
  if (!line) return
  // A pre-order line stops at its limit (#939), as the product page's stepper does.
  const cap = line.preorder ? await preorderCap(ctx, line.variantId) : null
  // And every line at the store's cart limit (#156).
  const room = await limitRoom(ctx, cartId, line)
  const most = Math.min(cap ?? Number.POSITIVE_INFINITY, room ?? Number.POSITIVE_INFINITY)
  await ctx.tx
    .update(cartLine)
    .set({ quantity: Number.isFinite(most) ? Math.max(1, Math.min(quantity, most)) : quantity })
    .where(and(eq(cartLine.id, lineId), eq(cartLine.cartId, cartId)))
}
