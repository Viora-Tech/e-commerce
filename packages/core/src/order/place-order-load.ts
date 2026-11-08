/** SOURCE OF TRUTH: placeOrder's first step — WHAT: loadCart (the open cart, its lines as they sell now, pre-order campaigns and their stock) and the mixed-cart rule / WHY: split out of place-order.ts by step (#973) */
import { cart, cartLine, product, sellableStock, variant } from '@commerce/db'
import { eq } from 'drizzle-orm'
import { effectiveGstRatePercent, effectiveHsCode } from '../catalog/effective-tax'
import type { StoreContext } from '../context'
import {
  CartEmpty,
  CartNotOpen,
  NotSoldInMarket,
  PreorderMixedCart,
  PriceNotSet,
  VariantHidden,
} from '../errors'
import { unsoldInMarket } from '../markets/catalogs'
import {
  campaignApplies,
  campaignNoteSource,
  mixedCartVerdict,
  type PreorderCampaignTerms,
  preorderUnitPrice,
  soldOutInCartOutcome,
} from '../preorder/campaigns'
import {
  availableAtLocations,
  campaignsByIds,
  cartPrimaryMarketId,
} from '../preorder/campaigns-service'
import { resolvePreorderSettings } from '../preorder/settings'
import type { WorkflowStep } from '../workflow/run'
import { checkGiftCardRules } from './place-order-rules'
import type { Line, State } from './place-order-types'

export const loadCart: WorkflowStep<State> = {
  name: 'loadCart',
  async run({ ctx, input }) {
    const [c] = await ctx.tx.select().from(cart).where(eq(cart.id, input.cartId))
    if (c?.status !== 'open') throw new CartNotOpen(input.cartId, ctx.storeId)
    const rows = await ctx.tx
      .select({
        variantId: cartLine.variantId,
        productId: product.id,
        linePreorder: cartLine.preorder,
        lineCampaignId: cartLine.preorderCampaignId,
        productCampaignId: product.preorderCampaignId,
        preorderOwn: product.preorderOwn,
        trackInventory: variant.trackInventory,
        onHand: sellableStock.onHand,
        reserved: sellableStock.reserved,
        quantity: cartLine.quantity,
        unitPricePaise: cartLine.unitPricePaise,
        variantPricePaise: variant.pricePaise,
        hiddenOnStore: variant.hiddenOnStore,
        title: product.title,
        variantTitle: variant.title,
        gstRatePercent: effectiveGstRatePercent,
        taxable: variant.taxable,
        hsCode: effectiveHsCode,
        giftCard: product.isGiftCard,
        requiresShipping: variant.requiresShipping,
        weightGrams: variant.weightGrams,
        costPaise: variant.costPaise,
        launchAt: product.launchAt,
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
      .where(eq(cartLine.cartId, input.cartId))
    if (rows.length === 0) throw new CartEmpty(input.cartId, ctx.storeId)
    // The cart snapshots the price, but a price withdrawn since (#913) stops the order.
    const unpriced = rows.find((r) => r.variantPricePaise == null)
    if (unpriced) throw new PriceNotSet(unpriced.variantId, ctx.storeId)
    // Hidden after it went into the cart (#934): the shopper can no longer buy it.
    const hidden = rows.find((r) => r.hiddenOnStore)
    if (hidden) throw new VariantHidden(hidden.variantId, ctx.storeId)
    // The cart's market sells from a catalog that leaves it out (Markets › Catalogs).
    const unsold = new Set(
      await unsoldInMarket(
        ctx.tx,
        c.marketId,
        rows.map((r) => r.productId),
      ),
    )
    const outside = rows.find((r) => unsold.has(r.productId))
    if (outside) throw new NotSoldInMarket(outside.variantId, ctx.storeId)
    const campaignOf = await checkoutCampaigns(ctx, c.marketId, rows)
    const located = await campaignStock(ctx, rows, campaignOf)
    // Campaign rules re-checked here whatever the cart showed (#143): a line in stock when it
    // went in that sold out since turns into a pre-order or is refused (`sold_out_in_cart`),
    // and the pre-order discount prices only lines that sell as pre-orders under it now.
    const sold = rows.map((r) => {
      const campaign = campaignOf(r)
      const settings = resolvePreorderSettings(r, r.preorderOverride, campaign)
      if (!campaign || !settings.enabled) {
        // Priced by a campaign that no longer applies: back to the list price.
        const unitPricePaise =
          r.lineCampaignId && r.variantPricePaise != null && r.unitPricePaise < r.variantPricePaise
            ? r.variantPricePaise
            : r.unitPricePaise
        return { r, campaign: null, settings, unitPricePaise }
      }
      const tracked = r.trackInventory && !r.giftCard
      const available = located.get(r.variantId) ?? Math.max(0, (r.onHand ?? 0) - (r.reserved ?? 0))
      const outcome = soldOutInCartOutcome({
        wasPreorder: r.linePreorder,
        soldOut: tracked && available < r.quantity,
        rule: campaign.soldOutInCart,
      })
      const preorder = outcome === 'preorder'
      const list = r.variantPricePaise ?? r.unitPricePaise
      // `block` sells the line from stock, so routing refuses it as out of stock.
      return {
        r,
        campaign,
        settings: preorder ? settings : { ...settings, enabled: false },
        unitPricePaise: preorder ? preorderUnitPrice(list, campaign) : list,
      }
    })
    const lines: Line[] = sold.map(({ r, campaign, settings, unitPricePaise }) => ({
      variantId: r.variantId,
      productId: r.productId,
      quantity: r.quantity,
      unitPricePaise,
      title: r.title,
      variantTitle: r.variantTitle,
      gstRatePercent: r.gstRatePercent,
      taxable: r.taxable,
      hsCode: r.hsCode,
      giftCard: r.giftCard,
      requiresShipping: r.requiresShipping,
      weightGrams: r.weightGrams,
      costPaise: r.costPaise,
      launchAt: r.launchAt,
      preorder: settings,
      preorderNote: campaignNoteSource({
        productNote: r.preorderNote,
        own: r.preorderOwn,
        campaign,
        place: 'order',
      }),
      preorderCampaign: campaign,
    }))
    checkGiftCardRules(lines, input, ctx.storeId)
    // Mixed carts (#143): a campaign that keeps its pre-orders apart refuses the order.
    const verdict = mixedCartOf(lines)
    if (verdict.kind === 'blocked') {
      throw new PreorderMixedCart(verdict.message, verdict.campaignName, ctx.storeId)
    }
    return {
      lines,
      cartDiscountCode: c.discountCode,
      cartAttribution: c.attribution ?? null,
      cartTracking: c.tracking ?? null,
    }
  },
}

type CampaignRow = {
  productCampaignId: string | null
  lineCampaignId: string | null
}

/**
 * Each cart line's campaign at checkout: the one it went in under, while the product is still
 * in it and it still applies to this cart (active, online store, the cart's market). A product
 * that joined a campaign after it went into the cart takes it now.
 */
async function checkoutCampaigns(
  ctx: StoreContext,
  marketId: string | null,
  rows: readonly CampaignRow[],
): Promise<(r: CampaignRow) => PreorderCampaignTerms | null> {
  const campaigns = await campaignsByIds(
    ctx.tx,
    rows.map((r) => r.productCampaignId),
  )
  const needsPrimary = !marketId && [...campaigns.values()].some((c) => c.marketIds.length > 0)
  const primaryMarketId = needsPrimary ? await cartPrimaryMarketId(ctx.tx) : null
  return (r) => {
    const c = r.productCampaignId ? campaigns.get(r.productCampaignId) : undefined
    if (!c) return null
    return campaignApplies(c, { marketId, primaryMarketId, channel: 'online_store' }) ? c : null
  }
}

/** Free stock at a campaign's own locations, for the lines whose campaign names some. */
async function campaignStock(
  ctx: StoreContext,
  rows: readonly (CampaignRow & { variantId: string })[],
  campaignOf: (r: CampaignRow) => PreorderCampaignTerms | null,
): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  for (const r of rows) {
    const c = campaignOf(r)
    if (!c || c.locationIds.length === 0) continue
    const at = await availableAtLocations(ctx.tx, [r.variantId], c.locationIds)
    out.set(r.variantId, at.get(r.variantId) ?? 0)
  }
  return out
}

/** The mixed-cart rule over the order's lines as they sell now. */
export const mixedCartOf = (lines: readonly Line[]) =>
  mixedCartVerdict(
    lines.map((l) => ({
      preorder: l.preorder.enabled,
      giftCard: l.giftCard,
      mixedCart: l.preorder.enabled ? (l.preorderCampaign?.mixedCart ?? null) : null,
      blockMessage: l.preorderCampaign?.content.blockMessage ?? null,
      campaignName: l.preorderCampaign?.name ?? null,
    })),
  )
