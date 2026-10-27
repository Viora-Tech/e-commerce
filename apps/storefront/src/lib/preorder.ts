import 'server-only'
import {
  balanceOwed,
  balancePayBy,
  depositIsNonRefundable,
  type PreorderStoreSettings,
  parsePreorderStoreSettings,
} from '@commerce/core'
import { computeDepositFromSettings, resolvePreorderSettings } from '@commerce/core/preorder'
import { cartLine, type order, product, type StoreTx, store, variant } from '@commerce/db'
import { and, eq } from 'drizzle-orm'

export async function storePreorderPolicy(
  tx: StoreTx,
  storeId: string,
): Promise<PreorderStoreSettings> {
  const [s] = await tx.select({ preorder: store.preorder }).from(store).where(eq(store.id, storeId))
  return parsePreorderStoreSettings(s?.preorder)
}

/** A cart's deposit pre-orders, as the checkout summary shows them before the shopper pays. */
export type CartDepositTerms = {
  /** The balance the deposit lines leave for later; 0 when nothing is deferred. */
  laterPaise: number
  /** Days to pay the balance before the deposit is kept, when the store keeps it. */
  nonRefundableDays: number | null
}

/**
 * What a deposit pre-order defers, worked out per line the way `placeOrder` does
 * (each line's own deposit rule on its list price), and whether the store keeps
 * unpaid deposits. Preview only: `placeOrder` decides what is charged.
 */
export async function cartDepositTerms(
  tx: StoreTx,
  storeId: string,
  cartId: string,
): Promise<CartDepositTerms> {
  const rows = await tx
    .select({
      p: product,
      override: variant.preorderOverride,
      quantity: cartLine.quantity,
      unitPricePaise: cartLine.unitPricePaise,
    })
    .from(cartLine)
    .innerJoin(variant, eq(variant.id, cartLine.variantId))
    .innerJoin(product, eq(product.id, variant.productId))
    .where(and(eq(cartLine.cartId, cartId), eq(cartLine.preorder, true)))
  let laterPaise = 0
  for (const r of rows) {
    const s = resolvePreorderSettings(r.p, r.override)
    if (!s.enabled || s.paymentMode === 'full') continue
    laterPaise += computeDepositFromSettings(
      r.quantity * r.unitPricePaise,
      s,
      r.quantity,
    ).balancePaise
  }
  if (laterPaise === 0) return { laterPaise: 0, nonRefundableDays: null }
  const policy = await storePreorderPolicy(tx, storeId)
  return {
    laterPaise,
    nonRefundableDays: depositIsNonRefundable(policy) ? policy.payWithinDays : null,
  }
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
  // An order edit's balance (no deposit) follows none of the pre-order deadlines or deposit rules.
  const deposit = o.depositPaise !== null
  return {
    owedPaise: owed,
    paidPaise: o.totalPaise - owed,
    payBy: deposit ? balancePayBy(policy, o.balanceRequestedAt) : null,
    nonRefundableDays: deposit && depositIsNonRefundable(policy) ? policy.payWithinDays : null,
  }
}
