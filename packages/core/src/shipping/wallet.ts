import { courierWalletBalance } from '@commerce/db'
import type { ShippingProvider } from '@commerce/shipping'
import { and, eq } from 'drizzle-orm'
import type { StoreContext } from '../context'

export type WalletRow = typeof courierWalletBalance.$inferSelect

export async function getWalletBalance(
  ctx: StoreContext,
  providerId: string,
): Promise<WalletRow | null> {
  const [row] = await ctx.tx
    .select()
    .from(courierWalletBalance)
    .where(
      and(
        eq(courierWalletBalance.storeId, ctx.storeId),
        eq(courierWalletBalance.provider, providerId),
      ),
    )
  return row ?? null
}

/**
 * Ask the courier for a fresh figure when it implements `getWalletBalance`
 * (no courier does yet - see packages/shipping-delhivery); otherwise this
 * just upserts the threshold, leaving the balance as whatever the merchant
 * last entered by hand.
 */
export async function refreshWalletBalance(
  ctx: StoreContext,
  provider: ShippingProvider,
  lowBalanceThresholdPaise?: number,
): Promise<WalletRow> {
  const current = await getWalletBalance(ctx, provider.id)
  let balancePaise = current?.balancePaise ?? 0
  let source: WalletRow['source'] = current?.source ?? 'manual'
  if (provider.getWalletBalance) {
    const r = await provider.getWalletBalance()
    balancePaise = r.balancePaise
    source = 'api'
  }
  const [row] = await ctx.tx
    .insert(courierWalletBalance)
    .values({
      storeId: ctx.storeId,
      provider: provider.id,
      balancePaise,
      lowBalanceThresholdPaise:
        lowBalanceThresholdPaise ?? current?.lowBalanceThresholdPaise ?? 50000,
      source,
      fetchedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [courierWalletBalance.storeId, courierWalletBalance.provider],
      set: {
        balancePaise,
        source,
        ...(lowBalanceThresholdPaise !== undefined ? { lowBalanceThresholdPaise } : {}),
        fetchedAt: new Date(),
      },
    })
    .returning()
  if (!row) throw new Error('could not record the wallet balance')
  return row
}

/** The merchant typing in what their Delhivery dashboard shows, since no adapter fetches it yet. */
export async function recordWalletBalance(
  ctx: StoreContext,
  providerId: string,
  balancePaise: number,
): Promise<WalletRow> {
  const current = await getWalletBalance(ctx, providerId)
  const [row] = await ctx.tx
    .insert(courierWalletBalance)
    .values({
      storeId: ctx.storeId,
      provider: providerId,
      balancePaise,
      lowBalanceThresholdPaise: current?.lowBalanceThresholdPaise ?? 50000,
      source: 'manual',
      fetchedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [courierWalletBalance.storeId, courierWalletBalance.provider],
      set: { balancePaise, source: 'manual', fetchedAt: new Date() },
    })
    .returning()
  if (!row) throw new Error('could not record the wallet balance')
  return row
}
