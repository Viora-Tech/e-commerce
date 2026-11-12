/** SOURCE OF TRUTH: cart line room — WHAT: how many of a variant a cart line may hold: free stock, pre-order caps and campaigns, the mixed-cart rule and the store's cart limit / WHY: addToCart, setLineQuantity and getCart share one rule; split out of cart.ts */
import {
  cartLine,
  homeSellingStock,
  preorderCampaign,
  product,
  sellableStock,
  store,
  variant,
} from '@commerce/db'
import { and, eq, ne } from 'drizzle-orm'
import { type CartLimit, lineRoom, productCartLimit } from '../checkout/cart-limit'
import { parseCheckoutSettings } from '../checkout/settings'
import type { StoreContext } from '../context'
import { PreorderMixedCart } from '../errors'
import {
  campaignApplies,
  mixedCartVerdict,
  type PreorderCampaignTerms,
} from '../preorder/campaigns'
import {
  availableAtLocations,
  campaignsByIds,
  cartPrimaryMarketId,
} from '../preorder/campaigns-service'
import { resolvePreorderSettings } from '../preorder/settings'

type AvailabilityRow = {
  trackInventory: boolean
  giftCard: boolean
  onHand: number | null
  reserved: number | null
  /**
   * The home selling row (`homeSellingStock`), where checkout holds a pre-order past stock and
   * counts its limit (#1538). Null: no row there. Left out: the totals stand in (old behaviour).
   */
  homeOnHand?: number | null
  homeReserved?: number | null
  preorderOverride: Parameters<typeof resolvePreorderSettings>[1]
  preorderEnabled: boolean
  preorderShipDate: Date | null
  preorderShipsInDays: number | null
  preorderLimit: number | null
  preorderButtonLabel: string
  preorderPaymentMode: 'full' | 'fixed' | 'percentage'
  preorderDepositPaise: number | null
  preorderDepositPercent: number | null
  preorderOwn?: string[] | null
}

/**
 * How many more of this line the shopper can add: real stock, plus pre-order
 * room beyond it, counted per variant: the variant's own limit, else the product's or the
 * campaign's (`resolvePreorderSettings`; unlimited when that is null). A
 * hint for the quantity stepper; `placeOrder`'s `reserveStock` is the actual
 * server-side check, and this counts what it counts (#1538): a line the store's stock covers
 * ships from stock (every selling location); a line past it is held whole at the home
 * location, where its free stock plus what is left of the limit (the units already sold past
 * stock there) caps it.
 */
export function lineAvailable(r: AvailabilityRow, campaign?: PreorderCampaignTerms | null): number {
  if (!r.trackInventory || r.giftCard) return 999
  const stock = Math.max(0, (r.onHand ?? 0) - (r.reserved ?? 0))
  const settings = resolvePreorderSettings(r, r.preorderOverride, campaign)
  if (!settings.enabled) return stock
  if (settings.limit == null) return 999
  const homeOnHand = r.homeOnHand === undefined ? r.onHand : r.homeOnHand
  const homeReserved = r.homeReserved === undefined ? r.reserved : r.homeReserved
  const homeFree = Math.max(0, (homeOnHand ?? 0) - (homeReserved ?? 0))
  const committed = Math.max(0, (homeReserved ?? 0) - (homeOnHand ?? 0))
  return Math.max(stock, homeFree + Math.max(0, settings.limit - committed))
}

/**
 * The most of a variant one cart line may hold while it sells on pre-order with a limit (#939):
 * the stock left plus the pre-order room. Null when nothing caps it here (no pre-order, no limit,
 * untracked or a gift card); `placeOrder`'s reservation still checks plain stock.
 */
export async function preorderCap(
  ctx: StoreContext,
  variantId: string,
  campaign: PreorderCampaignTerms | null,
): Promise<number | null> {
  const [r] = await ctx.tx
    .select({
      trackInventory: variant.trackInventory,
      giftCard: product.isGiftCard,
      onHand: sellableStock.onHand,
      reserved: sellableStock.reserved,
      homeOnHand: homeSellingStock.homeOnHand,
      homeReserved: homeSellingStock.homeReserved,
      preorderOverride: variant.preorderOverride,
      preorderEnabled: product.preorderEnabled,
      preorderShipDate: product.preorderShipDate,
      preorderShipsInDays: product.preorderShipsInDays,
      preorderLimit: product.preorderLimit,
      preorderButtonLabel: product.preorderButtonLabel,
      preorderPaymentMode: product.preorderPaymentMode,
      preorderDepositPaise: product.preorderDepositPaise,
      preorderDepositPercent: product.preorderDepositPercent,
      preorderOwn: product.preorderOwn,
    })
    .from(variant)
    .innerJoin(product, eq(product.id, variant.productId))
    .leftJoin(sellableStock, eq(sellableStock.variantId, variant.id))
    .leftJoin(homeSellingStock, eq(homeSellingStock.variantId, variant.id))
    .where(eq(variant.id, variantId))
  if (!r?.trackInventory || r.giftCard) return null
  const settings = resolvePreorderSettings(r, r.preorderOverride, campaign)
  if (!settings.enabled || settings.limit == null) return null
  return lineAvailable(r, campaign)
}

/** An active campaign as the cart sees it; paused or deleted ones are none. */
export const activeOf = (
  campaigns: ReadonlyMap<string, PreorderCampaignTerms>,
  id: string | null | undefined,
): PreorderCampaignTerms | null => {
  const c = id ? campaigns.get(id) : undefined
  return c?.status === 'active' ? c : null
}

/**
 * The product's campaign when it applies to this cart (#143): active, on the online store and
 * in the cart's market (a cart without one is in the primary market). Null otherwise: the
 * product sells by its own pre-order settings.
 */
export async function applicableCampaign(
  ctx: StoreContext,
  campaignId: string | null,
  marketId: string | null,
): Promise<PreorderCampaignTerms | null> {
  if (!campaignId) return null
  const c = (await campaignsByIds(ctx.tx, [campaignId])).get(campaignId)
  if (!c) return null
  const primaryMarketId =
    c.marketIds.length > 0 && !marketId ? await cartPrimaryMarketId(ctx.tx) : null
  return campaignApplies(c, { marketId, primaryMarketId, channel: 'online_store' }) ? c : null
}

/** Stock free to sell for this variant: at the campaign's locations when it names some. */
export async function freeStock(
  ctx: StoreContext,
  variantId: string,
  campaign: PreorderCampaignTerms | null,
): Promise<number> {
  if (campaign && campaign.locationIds.length > 0) {
    const at = await availableAtLocations(ctx.tx, [variantId], campaign.locationIds)
    return at.get(variantId) ?? 0
  }
  const [stock] = await ctx.tx
    .select({ onHand: sellableStock.onHand, reserved: sellableStock.reserved })
    .from(sellableStock)
    .where(eq(sellableStock.variantId, variantId))
  return Math.max(0, (stock?.onHand ?? 0) - (stock?.reserved ?? 0))
}

/**
 * Mixed carts (#143): a campaign that keeps its pre-orders apart refuses a cart where they
 * would sit beside in-stock goods, whichever of the two is added last.
 */
export async function checkMixedCart(
  ctx: StoreContext,
  cartId: string,
  added: {
    variantId: string
    preorder: boolean
    giftCard: boolean
    campaign: PreorderCampaignTerms | null
  },
): Promise<void> {
  const others = await ctx.tx
    .select({
      preorder: cartLine.preorder,
      giftCard: product.isGiftCard,
      status: preorderCampaign.status,
      mixedCart: preorderCampaign.mixedCart,
      name: preorderCampaign.name,
      content: preorderCampaign.content,
    })
    .from(cartLine)
    .innerJoin(variant, eq(variant.id, cartLine.variantId))
    .innerJoin(product, eq(product.id, variant.productId))
    .leftJoin(preorderCampaign, eq(preorderCampaign.id, cartLine.preorderCampaignId))
    .where(and(eq(cartLine.cartId, cartId), ne(cartLine.variantId, added.variantId)))
  const verdict = mixedCartVerdict([
    ...others.map((o) => ({
      preorder: o.preorder,
      giftCard: o.giftCard,
      mixedCart: o.preorder && o.status === 'active' ? o.mixedCart : null,
      blockMessage: o.content?.blockMessage ?? null,
      campaignName: o.name,
    })),
    {
      preorder: added.preorder,
      giftCard: added.giftCard,
      mixedCart: added.preorder && added.campaign ? added.campaign.mixedCart : null,
      blockMessage: added.campaign?.content.blockMessage ?? null,
      campaignName: added.campaign?.name ?? null,
    },
  ])
  if (verdict.kind === 'blocked') {
    throw new PreorderMixedCart(verdict.message, verdict.campaignName, ctx.storeId)
  }
}

/** Settings → Checkout → Cart limit (#156). */
export async function storeCartLimit(ctx: StoreContext): Promise<CartLimit> {
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
export async function limitRoom(
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
