import {
  balanceOwed,
  balancePayBy,
  depositIsNonRefundable,
  type PreorderStoreSettings,
  parsePreorderStoreSettings,
} from '@commerce/core'
import { resolvePreorderSettings } from '@commerce/core/preorder'
import { cartLine, type order, product, type StoreTx, store, variant } from '@commerce/db'
import { and, eq } from 'drizzle-orm'

export async function storePreorderPolicy(
  tx: StoreTx,
  storeId: string,
): Promise<PreorderStoreSettings> {
  const [s] = await tx.select({ preorder: store.preorder }).from(store).where(eq(store.id, storeId))
  return parsePreorderStoreSettings(s?.preorder)
}

/**
 * Days after the balance request within which the balance must be paid, when
 * the cart has a deposit pre-order and the store keeps unpaid deposits. The
 * checkout says so before the shopper pays. Null otherwise.
 */
export async function nonRefundableDepositDays(
  tx: StoreTx,
  storeId: string,
  cartId: string,
): Promise<number | null> {
  const policy = await storePreorderPolicy(tx, storeId)
  if (!depositIsNonRefundable(policy)) return null
  const rows = await tx
    .select({ p: product, override: variant.preorderOverride })
    .from(cartLine)
    .innerJoin(variant, eq(variant.id, cartLine.variantId))
    .innerJoin(product, eq(product.id, variant.productId))
    .where(and(eq(cartLine.cartId, cartId), eq(cartLine.preorder, true)))
  const deposit = rows.some((r) => {
    const s = resolvePreorderSettings(r.p, r.override)
    return s.enabled && s.paymentMode !== 'full'
  })
  return deposit ? policy.payWithinDays : null
}

export type BalanceView = {
  owedPaise: number
  paidPaise: number
  payBy: Date | null
  nonRefundableDays: number | null
}

/** What the shopper still owes on a deposit pre-order, for the thank-you, account and pay-link pages. */
export function balanceView(
  o: typeof order.$inferSelect,
  policy: PreorderStoreSettings,
): BalanceView | null {
  const owed = o.checkoutPaidAt ? balanceOwed(o) : 0
  if (owed <= 0) return null
  return {
    owedPaise: owed,
    paidPaise: o.totalPaise - owed,
    payBy: balancePayBy(policy, o.balanceRequestedAt),
    nonRefundableDays: depositIsNonRefundable(policy) ? policy.payWithinDays : null,
  }
}
