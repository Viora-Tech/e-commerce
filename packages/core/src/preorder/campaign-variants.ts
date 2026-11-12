/** SOURCE OF TRUTH: campaignVariants, setCampaignVariantLimits
 * WHAT:  Each variant's own pre-order limit, read and written from the campaign page so the
 *        merchant types every variant's limit in one place. The limit lives on
 *        `variant.preorder_override.limit`, the same key the variant page edits (#1537): there is
 *        no second copy on the campaign.
 * WHY:   Per-variant limits only; the product's (or campaign's) limit is what a blank one uses.
 * WHERE: `preorders.campaigns.variants` and the campaign create/update (`./campaigns-service`).
 */
import { product, type StoreTx, variant } from '@commerce/db'
import { and, asc, eq, inArray, isNull } from 'drizzle-orm'
import type { StoreContext } from '../context'
import type { PreorderCampaignVariantLimit } from './campaigns'
import { variantPreorderLimit, withPreorderLimit } from './settings'

/** A variant on the campaign page: its name, SKU and its own limit (null: uses the default). */
export type PreorderCampaignVariant = {
  id: string
  productId: string
  title: string
  sku: string | null
  limit: number | null
}

/** The live variants of these products, in their product's order, with their own limits. */
export async function campaignVariants(
  ctx: StoreContext,
  productIds: readonly string[],
): Promise<PreorderCampaignVariant[]> {
  if (productIds.length === 0) return []
  const rows = await ctx.tx
    .select({
      id: variant.id,
      productId: variant.productId,
      title: variant.title,
      sku: variant.sku,
      override: variant.preorderOverride,
    })
    .from(variant)
    .where(and(inArray(variant.productId, [...productIds]), isNull(variant.archivedAt)))
    .orderBy(asc(variant.position), asc(variant.id))
  return rows.map(({ override, ...v }) => ({ ...v, limit: variantPreorderLimit(override) }))
}

/**
 * Write each variant's own limit (null: blank, use the product's or campaign's) onto its
 * override, keeping the other keys it holds. Only live variants of products in this campaign
 * change; any other id is skipped. Runs in the campaign save's transaction.
 */
export async function setCampaignVariantLimits(
  tx: StoreTx,
  campaignId: string,
  limits: readonly PreorderCampaignVariantLimit[],
): Promise<void> {
  if (limits.length === 0) return
  const wanted = new Map(limits.map((l) => [l.variantId, l.limit]))
  const rows = await tx
    .select({ id: variant.id, override: variant.preorderOverride })
    .from(variant)
    .innerJoin(product, eq(product.id, variant.productId))
    .where(
      and(
        inArray(variant.id, [...wanted.keys()]),
        eq(product.preorderCampaignId, campaignId),
        isNull(variant.archivedAt),
      ),
    )
  const now = new Date()
  for (const v of rows) {
    const limit = wanted.get(v.id) ?? null
    if (variantPreorderLimit(v.override) === limit) continue
    await tx
      .update(variant)
      .set({ preorderOverride: withPreorderLimit(v.override, limit), updatedAt: now })
      .where(eq(variant.id, v.id))
  }
}
