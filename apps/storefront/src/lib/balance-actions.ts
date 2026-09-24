'use server'

import { BalanceNotPayable, balanceProvider, startBalancePayment } from '@commerce/core'
import { order, payment } from '@commerce/db'
import { and, eq } from 'drizzle-orm'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { db } from './db'
import { nudgeOutbox } from './outbox'
import { storePaymentProviders } from './payments'
import { clientIp, rateLimited } from './rate-limit'
import { inStore } from './store-context'

/** Per IP and per order: taps on "Pay balance" each start (or reuse) a gateway session. */
const PAY_BALANCE_RULE = { limit: 10, windowMs: 60_000 }

/**
 * "Pay balance" on the thank-you page, the account order page and the signed
 * pay link. The store is the one the proxy resolved from the hostname, never
 * a form value. Two taps get the same open attempt; the gateway is asked
 * after the attempt is committed. Lands on the gateway, or back on the
 * thank-you page, which shows where the balance stands.
 */
export async function payBalanceAction(orderNumber: number): Promise<void> {
  const h = await headers()
  const storeId = h.get('x-store-id')
  if (!storeId) throw new Error('store not resolved')
  const back = `/checkout/thank-you/${orderNumber}`
  const [byIp, byOrder] = await Promise.all([
    rateLimited('pay-balance:ip', clientIp(h), PAY_BALANCE_RULE),
    rateLimited('pay-balance:order', `${storeId}:${orderNumber}`, PAY_BALANCE_RULE),
  ])
  if (!byIp.ok || !byOrder.ok) redirect(`${back}?balance=busy`)

  const target = await inStore(storeId, async (tx) => {
    const [o] = await tx.select({ id: order.id }).from(order).where(eq(order.number, orderNumber))
    if (!o) return null
    const [deposit] = await tx
      .select({ provider: payment.provider })
      .from(payment)
      .where(and(eq(payment.orderId, o.id), eq(payment.purpose, 'order')))
      .limit(1)
    const provider = balanceProvider(
      await storePaymentProviders(tx, storeId),
      deposit?.provider ?? null,
    )
    return provider ? { orderId: o.id, provider } : null
  })
  if (!target) redirect(back)

  const started = await startBalancePayment(db(), storeId, target.orderId, target.provider).catch(
    (err: unknown) => {
      // Paid or cancelled meanwhile: the thank-you page shows where it stands.
      if (err instanceof BalanceNotPayable) return null
      throw err
    },
  )
  if (started?.becameCaptured) await nudgeOutbox(storeId)
  if (started?.session?.kind === 'client') redirect(`/checkout/pay/${orderNumber}`)
  if (started?.session?.kind === 'redirect') redirect(started.session.url)
  redirect(back)
}
