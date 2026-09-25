'use server'

import { loadEnv } from '@commerce/config'
import {
  BalanceNotPayable,
  balanceProvider,
  orderViewToken,
  payPath,
  startBalancePayment,
  thankYouPath,
} from '@commerce/core'
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
  // Looked up first so every exit below, including a rate-limited one, can
  // still carry a validly-tokened thank-you link.
  const orderId = await inStore(storeId, async (tx) => {
    const [o] = await tx.select({ id: order.id }).from(order).where(eq(order.number, orderNumber))
    return o?.id ?? null
  })
  // No order: nothing to tell apart from a stray order number, so the
  // fallback (untokened) link is fine — the page 404s on it either way.
  if (!orderId) redirect(`/checkout/thank-you/${orderNumber}`)
  const oid: string = orderId
  const secret = loadEnv(process.env).SETTINGS_SECRET
  const back = (busy = false): never =>
    redirect(
      `${thankYouPath(orderNumber, orderViewToken(oid, secret))}${busy ? '&balance=busy' : ''}`,
    )
  const [byIp, byOrder] = await Promise.all([
    rateLimited('pay-balance:ip', clientIp(h), PAY_BALANCE_RULE),
    rateLimited('pay-balance:order', `${storeId}:${orderNumber}`, PAY_BALANCE_RULE),
  ])
  if (!byIp.ok || !byOrder.ok) back(true)

  const target = await inStore(storeId, async (tx) => {
    const [deposit] = await tx
      .select({ provider: payment.provider })
      .from(payment)
      .where(and(eq(payment.orderId, oid), eq(payment.purpose, 'order')))
      .limit(1)
    return balanceProvider(await storePaymentProviders(tx, storeId), deposit?.provider ?? null)
  })
  if (!target) redirect(thankYouPath(orderNumber, orderViewToken(oid, secret)))

  const started = await startBalancePayment(db(), storeId, oid, target).catch((err: unknown) => {
    // Paid or cancelled meanwhile: the thank-you page shows where it stands.
    if (err instanceof BalanceNotPayable) return null
    throw err
  })
  if (started?.becameCaptured) await nudgeOutbox(storeId)
  if (started?.session?.kind === 'client') {
    redirect(payPath(orderNumber, orderViewToken(oid, secret)))
  }
  if (started?.session?.kind === 'redirect') redirect(started.session.url)
  back()
}
