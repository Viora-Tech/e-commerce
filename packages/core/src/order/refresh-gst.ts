/** SOURCE OF TRUTH: re-reading an order's GST from its products — WHAT each line's GST rate and HSN as the product has them now / WHY an order keeps the rate it was placed with, so a product whose Charge GST or rate was fixed afterwards leaves its earlier orders at the old rate until someone asks for this */
import { orderLine, product, type StoreTx, store, variant } from '@commerce/db'
import { and, eq, isNotNull } from 'drizzle-orm'
import { effectiveGstRatePercent, effectiveHsCode } from '../catalog/effective-tax'
import { parseStoreTax } from '../tax/settings'
import { lineGstRate } from './place-order-rules'

/**
 * Sets each line's GST rate and HSN from its product's current settings (Charge GST, rate,
 * HSN), the way checkout would today. Lines whose product is gone keep what they have. Prices
 * stay as they are: they include GST, so only the split into taxable value and tax changes.
 * Returns how many lines changed.
 */
export async function refreshOrderLineGst(tx: StoreTx, orderId: string): Promise<number> {
  const [s] = await tx.select({ rate: store.gstRatePercent, apps: store.apps }).from(store)
  if (!s) return 0
  const storeTax = parseStoreTax(s.apps)
  const lines = await tx
    .select({
      id: orderLine.id,
      giftCard: orderLine.giftCard,
      rate: orderLine.gstRatePercent,
      hsCode: orderLine.hsCode,
      taxable: variant.taxable,
      productRate: effectiveGstRatePercent,
      productHsn: effectiveHsCode,
    })
    .from(orderLine)
    .innerJoin(variant, eq(variant.id, orderLine.variantId))
    .innerJoin(product, eq(product.id, variant.productId))
    .where(and(eq(orderLine.orderId, orderId), isNotNull(orderLine.variantId)))
  let changed = 0
  for (const l of lines) {
    const rate = lineGstRate(
      { giftCard: l.giftCard, taxable: l.taxable, gstRatePercent: l.productRate },
      s.rate,
      storeTax,
    )
    const hsCode = l.giftCard ? null : (l.productHsn ?? l.hsCode)
    if (rate === l.rate && hsCode === l.hsCode) continue
    await tx.update(orderLine).set({ gstRatePercent: rate, hsCode }).where(eq(orderLine.id, l.id))
    changed++
  }
  return changed
}
