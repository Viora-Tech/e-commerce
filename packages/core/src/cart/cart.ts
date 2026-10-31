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
import { and, asc, eq, inArray } from 'drizzle-orm'
import { lineRoom, productCartLimit } from '../checkout/cart-limit'
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
import {
  type CampaignColours,
  campaignColours,
  campaignLineIsPreorder,
  campaignNoteSource,
  preorderUnitPrice,
} from '../preorder/campaigns'
import { campaignsByIds } from '../preorder/campaigns-service'
import { isLaunched } from '../preorder/launch'
import { preorderNoteText } from '../preorder/note'
import { resolvePreorderSettings, resolveShipDate } from '../preorder/settings'
import { parsePreorderStoreSettings } from '../preorder/store-settings'
import {
  activeOf,
  applicableCampaign,
  checkMixedCart,
  freeStock,
  limitRoom,
  lineAvailable,
  preorderCap,
  storeCartLimit,
} from './cart-room'

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
  /** The pre-order campaign's badge text on a pre-order line (#144); null without one. */
  preorderBadge?: string | null | undefined
  /** The campaign's colours (hex, checked); null keys use the theme's. */
  preorderColours?: CampaignColours | null | undefined
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
      campaignId: cartLine.preorderCampaignId,
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
      preorderOwn: product.preorderOwn,
    })
    .from(cartLine)
    .innerJoin(variant, eq(variant.id, cartLine.variantId))
    .innerJoin(product, eq(product.id, variant.productId))
    .leftJoin(sellableStock, eq(sellableStock.variantId, variant.id))
    .leftJoin(media, eq(media.id, variant.mediaId))
    .where(eq(cartLine.cartId, cartId))
  // Each line's campaign as it was added under (#142); a paused one no longer shapes it.
  const campaigns = await campaignsByIds(
    ctx.tx,
    rows.map((r) => r.campaignId),
  )
  const campaignOf = (r: (typeof rows)[number]) => activeOf(campaigns, r.campaignId)
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
          productNote: campaignNoteSource({
            productNote: r.preorderNote,
            own: r.preorderOwn,
            campaign: campaignOf(r),
            place: 'cart',
          }),
          storeNote,
          shipDate: resolveShipDate(resolvePreorderSettings(r, r.preorderOverride, campaignOf(r))),
        })
      : null
  const badgeOf = (r: (typeof rows)[number]) => {
    const c = r.preorder ? campaignOf(r) : null
    return c?.content.badgeText?.trim() || null
  }
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
    available: Math.min(lineAvailable(r, campaignOf(r)), roomOf(r) ?? Number.POSITIVE_INFINITY),
    imageUrl: r.imageUrl ?? firstImages.get(r.productId) ?? null,
    giftCard: r.giftCard,
    preorder: r.preorder,
    preorderNote: noteOf(r),
    preorderBadge: badgeOf(r),
    preorderColours: badgeOf(r) ? campaignColours(campaignOf(r)?.design) : null,
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
  const listPricePaise = v.pricePaise
  if (listPricePaise == null) throw new PriceNotSet(variantId, ctx.storeId)
  const [existing] = await ctx.tx
    .select()
    .from(cartLine)
    .where(and(eq(cartLine.cartId, cartId), eq(cartLine.variantId, variantId)))
  const wanted = (existing?.quantity ?? 0) + quantity
  // A campaign that applies here (#142, #143) supplies the pre-order settings; the product's
  // own settings otherwise.
  const campaign = await applicableCampaign(ctx, p.preorderCampaignId, marketId ?? null)
  const enabled = resolvePreorderSettings(p, v.preorderOverride, campaign).enabled
  const tracked = v.trackInventory && !p.isGiftCard
  // Under a campaign a line is a pre-order only when the stock that counts cannot cover it;
  // outside one, pre-order on is a pre-order (the older rule).
  const preorder =
    enabled && campaign
      ? campaignLineIsPreorder({
          tracked,
          available: tracked ? await freeStock(ctx, variantId, campaign) : 0,
          quantity: wanted,
        })
      : enabled
  // Sold out and not on pre-order (the product has none, or this variant does not allow it,
  // #962): the product page crosses it out, and the cart refuses it too.
  if (!enabled && tracked && (await freeStock(ctx, variantId, null)) < 1) {
    throw new OutOfStock(variantId, ctx.storeId)
  }
  await checkMixedCart(ctx, cartId, { variantId, preorder, giftCard: p.isGiftCard, campaign })
  // The campaign's pre-order discount prices the line while it is a pre-order.
  const unitPricePaise =
    preorder && campaign ? preorderUnitPrice(listPricePaise, campaign) : listPricePaise
  const preorderCampaignId = campaign?.id ?? null
  // A pre-order with a limit holds no more than the stock and pre-order room left (#939).
  const cap = enabled ? await preorderCap(ctx, variantId, campaign) : null
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
      .set({
        quantity: Math.max(existing.quantity, next),
        unitPricePaise,
        preorder,
        preorderCampaignId,
      })
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
      preorderCampaignId,
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
      campaignId: cartLine.preorderCampaignId,
      productId: variant.productId,
      giftCard: product.isGiftCard,
    })
    .from(cartLine)
    .innerJoin(variant, eq(variant.id, cartLine.variantId))
    .innerJoin(product, eq(product.id, variant.productId))
    .where(and(eq(cartLine.id, lineId), eq(cartLine.cartId, cartId)))
  if (!line) return
  // A pre-order line stops at its limit (#939), as the product page's stepper does.
  const campaign = activeOf(await campaignsByIds(ctx.tx, [line.campaignId]), line.campaignId)
  const cap = line.preorder ? await preorderCap(ctx, line.variantId, campaign) : null
  // And every line at the store's cart limit (#156).
  const room = await limitRoom(ctx, cartId, line)
  const most = Math.min(cap ?? Number.POSITIVE_INFINITY, room ?? Number.POSITIVE_INFINITY)
  await ctx.tx
    .update(cartLine)
    .set({ quantity: Number.isFinite(most) ? Math.max(1, Math.min(quantity, most)) : quantity })
    .where(and(eq(cartLine.id, lineId), eq(cartLine.cartId, cartId)))
}
