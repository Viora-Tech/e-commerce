/** SOURCE OF TRUTH: pre-orders on a draft — WHAT: which of a draft's variants may sell past stock, by the same product, variant and campaign rules as checkout / WHY: a draft that refused them could not place an order a shopper could place */
import { orderLine, product, variant } from '@commerce/db'
import { eq, inArray } from 'drizzle-orm'
import type { StoreContext } from '../context'
import { campaignApplies } from '../preorder/campaigns'
import { campaignsByIds, cartPrimaryMarketId } from '../preorder/campaigns-service'
import {
  type PreorderSettings,
  resolvePreorderSettings,
  resolveShipDate,
} from '../preorder/settings'

/** Each variant's pre-order settings; a draft has no market, so a campaign is judged without one. */
export async function draftPreorders(
  ctx: StoreContext,
  variantIds: readonly string[],
): Promise<Map<string, PreorderSettings>> {
  if (variantIds.length === 0) return new Map()
  const rows = await ctx.tx
    .select({
      variantId: variant.id,
      preorderOverride: variant.preorderOverride,
      productCampaignId: product.preorderCampaignId,
      preorderOwn: product.preorderOwn,
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
    .where(inArray(variant.id, [...variantIds]))
  const campaigns = await campaignsByIds(
    ctx.tx,
    rows.map((r) => r.productCampaignId),
  )
  const primaryMarketId = campaigns.size > 0 ? await cartPrimaryMarketId(ctx.tx) : null
  return new Map(
    rows.map((r) => {
      const c = r.productCampaignId ? campaigns.get(r.productCampaignId) : null
      const applies = campaignApplies(c, {
        marketId: null,
        primaryMarketId,
        channel: 'online_store',
      })
      return [r.variantId, resolvePreorderSettings(r, r.preorderOverride, applies ? c : null)]
    }),
  )
}

/** What routing needs to know: sell past stock, up to this limit. */
export function routingPreorder(settings: PreorderSettings | undefined) {
  return settings?.enabled ? { enabled: true, limit: settings.limit } : null
}

/** A line that has to wait for stock is a pre-order; one shipped from what is on hand is not. */
export async function markPreorderLines(
  ctx: StoreContext,
  lines: readonly { id: string; variantId: string }[],
  parcels: readonly { status: string; lines: readonly { key: string }[] }[],
  preorders: Map<string, PreorderSettings>,
): Promise<void> {
  for (const line of lines) {
    const waits = parcels.some(
      (p) => p.status === 'on_hold' && p.lines.some((part) => part.key === line.id),
    )
    const settings = preorders.get(line.variantId)
    if (!waits || !settings?.enabled) continue
    await ctx.tx
      .update(orderLine)
      .set({
        preorder: true,
        preorderCampaignId: settings.campaignId ?? null,
        preorderShipDate: resolveShipDate(settings, new Date()),
      })
      .where(eq(orderLine.id, line.id))
  }
}
