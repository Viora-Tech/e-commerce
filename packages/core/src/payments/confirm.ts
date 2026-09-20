import { order, payment } from '@commerce/db'
import type { ClientConfirmation, PaymentProvider, PaymentStatus } from '@commerce/payments'
import { and, eq } from 'drizzle-orm'
import type { StoreContext } from '../context'

/** Apply a gateway status to our payment and order rows. Idempotent. */
export async function applyPaymentStatus(
  ctx: StoreContext,
  input: { providerRef: string; status: PaymentStatus; providerPaymentId: string | null },
) {
  const [p] = await ctx.tx.select().from(payment).where(eq(payment.providerRef, input.providerRef))
  if (!p) return null
  const status = input.status === 'authorized' ? 'pending' : input.status
  if (p.status === 'captured' && status !== 'refunded') return p // never downgrade a capture
  const [updated] = await ctx.tx
    .update(payment)
    .set({ status, providerPaymentId: input.providerPaymentId ?? p.providerPaymentId })
    .where(eq(payment.id, p.id))
    .returning()
  if (status === 'captured') {
    await ctx.tx
      .update(order)
      .set({ status: 'paid' })
      .where(and(eq(order.id, p.orderId), eq(order.status, 'placed')))
  }
  return updated ?? null
}

/** Browser came back from a client-side checkout: verify with the adapter, then record. */
export async function confirmClientPayment(
  ctx: StoreContext,
  provider: PaymentProvider,
  providerRef: string,
  confirmation: ClientConfirmation,
) {
  const r = await provider.confirm(providerRef, confirmation)
  return applyPaymentStatus(ctx, {
    providerRef,
    status: r.status,
    providerPaymentId: r.providerPaymentId,
  })
}
