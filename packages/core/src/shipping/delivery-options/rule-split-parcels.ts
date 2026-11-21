/** SOURCE OF TRUTH: a parcel split by product rules at checkout — WHAT: `ruleSplitter` builds
 * the `splitByRule` step `quoteParcelDeliveries` runs after the first courier answers: when a
 * parcel's products are under rules with no courier in common (`ruleGroups`), it becomes one
 * parcel per group, each with its own lines, share of the value, box and billed weight / WHY:
 * owner, 21 Nov 2026: such a cart ships as separate parcels (one label each) instead of one rule
 * overruling the other. The new parcels' keys are the parcel's own `locationId:status` key with
 * `:1`, `:2` after it, so the order still knows where each leaves from.
 */
import { cartLine, type StoreTx, variant } from '@commerce/db'
import { eq, inArray } from 'drizzle-orm'
import type { ShippingSettings } from '../settings'
import type { QuoteParcel } from './checkout'
import type { DeliveryConfig } from './config'
import { shareValue } from './parcels'
import type { ProviderAnswer } from './routes'
import { ruleGroups } from './rule-split'
import { cartParcelFor } from './service'

/** A parcel key made by a rule split (`loc:open:2`) rather than by where it leaves from. */
export const isRuleSplitKey = (key: string): boolean => key.split(':').length > 2

/**
 * The `splitByRule` step for `quoteParcelDeliveries` on this cart. Unit prices come from the
 * cart's lines, to share each parcel's value out between its groups.
 */
export function ruleSplitter(
  tx: StoreTx,
  input: { cartId: string; config: DeliveryConfig; boxPresets: ShippingSettings['boxPresets'] },
): (parcel: QuoteParcel, answers: readonly ProviderAnswer[]) => Promise<QuoteParcel[] | null> {
  return async (parcel, answers) => {
    const groups = ruleGroups(input.config, parcel.cart.items, answers, parcel.weightGrams)
    if (!groups) return null
    const ids = [...new Set(parcel.lines.map((l) => l.variantId))]
    const [owners, prices] = await Promise.all([
      tx
        .select({ id: variant.id, productId: variant.productId })
        .from(variant)
        .where(inArray(variant.id, ids)),
      tx
        .select({ variantId: cartLine.variantId, unitPricePaise: cartLine.unitPricePaise })
        .from(cartLine)
        .where(eq(cartLine.cartId, input.cartId)),
    ])
    const productOf = new Map(owners.map((v) => [v.id, v.productId]))
    const unit = new Map(prices.map((p) => [p.variantId, p.unitPricePaise]))
    const groupOf = (variantId: string) => {
      const at = groups.findIndex((g) => g.includes(productOf.get(variantId) ?? ''))
      // A line no group names (no product facts) rides with the first parcel.
      return at < 0 ? 0 : at
    }
    const parts = groups
      .map((products, g) => ({
        products,
        lines: parcel.lines.filter((l) => groupOf(l.variantId) === g),
      }))
      .filter((p) => p.lines.length > 0)
    if (parts.length < 2) return null
    const values = shareValue(
      parcel.valuePaise,
      parts.map((p) => p.lines.reduce((s, l) => s + (unit.get(l.variantId) ?? 0) * l.quantity, 0)),
    )
    return Promise.all(
      parts.map(async (p, i) => {
        const box = await cartParcelFor(tx, p.lines, input.boxPresets)
        const valuePaise = values[i] ?? 0
        return {
          key: `${parcel.key}:${i + 1}`,
          lines: p.lines,
          originPincode: parcel.originPincode,
          valuePaise,
          weightGrams: box.billedGrams,
          dimensionsCm: box.dimensionsCm,
          cart: {
            valuePaise,
            weightGrams: box.billedGrams,
            items: parcel.cart.items.filter((it) => p.products.includes(it.productId)),
          },
        }
      }),
    )
  }
}
