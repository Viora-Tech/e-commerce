/** SOURCE OF TRUTH: cart re-pricing — WHAT: bring each cart line to its variant's live price, keeping the old price when it went up (a sale ended) so the cart and checkout can say so / WHY: owner decision 24 Nov 2026, a cart kept a sale price after the sale ended; the cart, the discount, GST and placeOrder all read the line's price */
import { cartLine, variant } from '@commerce/db'
import { and, eq, isNotNull, isNull, ne, sql } from 'drizzle-orm'
import type { StoreContext } from '../context'

/**
 * Re-price the cart's lines at the live price. A line under a pre-order campaign is left to
 * the campaign's own pricing (`placeOrder` re-checks it). A price that went up keeps what the
 * line was added at in `sale_ended_from_paise` (the first one, if it rose twice); a price back
 * at or below what the line was added at clears it.
 */
export async function repriceCartLines(ctx: StoreContext, cartId: string): Promise<void> {
  await ctx.tx
    .update(cartLine)
    .set({
      unitPricePaise: sql`${variant.pricePaise}`,
      saleEndedFromPaise: sql`case
        when ${variant.pricePaise} > coalesce(${cartLine.saleEndedFromPaise}, ${cartLine.unitPricePaise})
        then coalesce(${cartLine.saleEndedFromPaise}, ${cartLine.unitPricePaise}) end`,
    })
    .from(variant)
    .where(
      and(
        eq(cartLine.cartId, cartId),
        eq(variant.id, cartLine.variantId),
        isNull(cartLine.preorderCampaignId),
        isNotNull(variant.pricePaise),
        ne(cartLine.unitPricePaise, variant.pricePaise),
      ),
    )
}
