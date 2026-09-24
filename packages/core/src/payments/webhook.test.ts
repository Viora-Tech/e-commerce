import { createDb, order, outboxEvent, payment, paymentEvent, store, withStore } from '@commerce/db'
import { resetDb } from '@commerce/db/test'
import type { PaymentProvider } from '@commerce/payments'
import { eq } from 'drizzle-orm'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { handlePaymentWebhook } from './webhook'

const owner = createDb(process.env.DATABASE_URL_OWNER as string)
const app = createDb(process.env.DATABASE_URL as string)

beforeEach(async () => {
  await resetDb(owner)
})
afterAll(async () => {
  await owner.$client.end()
  await app.$client.end()
})

/** A provider whose webhook parsing is scripted, so the pipeline is tested without a gateway. */
function scripted(
  events: Record<string, { eventId: string; providerRef: string }>,
): PaymentProvider {
  return {
    id: 'scripted',
    label: 'Scripted',
    async createPayment() {
      throw new Error('unused')
    },
    async confirm() {
      throw new Error('unused')
    },
    async fetchStatus() {
      throw new Error('unused')
    },
    async refund() {
      throw new Error('unused')
    },
    parseWebhook({ rawBody, headers }) {
      if (headers.sig !== 'good') return { ok: false, reason: 'bad signature' }
      const e = events[rawBody]
      if (!e) return { ok: false, reason: 'unknown' }
      return {
        ok: true,
        eventId: e.eventId,
        event: {
          type: 'payment.captured',
          providerRef: e.providerRef,
          providerPaymentId: 'pay_1',
          amountPaise: 100,
          orderId: null,
          raw: { rawBody },
        },
      }
    },
  }
}

async function seedOrder() {
  const [s] = await owner.insert(store).values({ slug: 'w', name: 'W' }).returning()
  if (!s) throw new Error('seed')
  const [o] = await owner
    .insert(order)
    .values({
      storeId: s.id,
      number: 1,
      status: 'placed',
      subtotalPaise: 100,
      totalPaise: 100,
      paymentMethod: 'scripted',
    })
    .returning()
  if (!o) throw new Error('seed')
  await owner.insert(payment).values({
    storeId: s.id,
    orderId: o.id,
    provider: 'scripted',
    providerRef: 'ref_1',
    status: 'pending',
    amountPaise: 100,
  })
  return { storeId: s.id, orderId: o.id }
}

describe('payment webhooks', () => {
  it('rejects a bad signature and stores nothing', async () => {
    const { storeId } = await seedOrder()
    const p = scripted({ captured: { eventId: 'evt_1', providerRef: 'ref_1' } })
    const r = await withStore(app, storeId, (tx) =>
      handlePaymentWebhook({ storeId, tx }, p, { rawBody: 'captured', headers: { sig: 'bad' } }),
    )
    expect(r.ok).toBe(false)
    expect(await owner.select().from(paymentEvent)).toEqual([])
  })

  it('applies a capture once and treats a retry as a duplicate', async () => {
    const { storeId, orderId } = await seedOrder()
    const p = scripted({ captured: { eventId: 'evt_1', providerRef: 'ref_1' } })
    const first = await withStore(app, storeId, (tx) =>
      handlePaymentWebhook({ storeId, tx }, p, { rawBody: 'captured', headers: { sig: 'good' } }),
    )
    expect(first).toMatchObject({
      ok: true,
      applied: true,
      duplicate: false,
      capturedOrderId: orderId,
    })
    const again = await withStore(app, storeId, (tx) =>
      handlePaymentWebhook({ storeId, tx }, p, { rawBody: 'captured', headers: { sig: 'good' } }),
    )
    expect(again).toMatchObject({
      ok: true,
      applied: false,
      duplicate: true,
      capturedOrderId: null,
    })

    const [o] = await owner.select().from(order).where(eq(order.id, orderId))
    expect(o?.status).toBe('paid')
    const [pay] = await owner.select().from(payment).where(eq(payment.providerRef, 'ref_1'))
    expect(pay).toMatchObject({ status: 'captured', providerPaymentId: 'pay_1' })
    const events = await owner.select().from(paymentEvent)
    expect(events).toHaveLength(1)
    expect(events[0]?.status).toBe('processed')

    // applyPaymentStatus wrote order.paid once, in the same transaction as the
    // capture; the duplicate delivery above did not run it again.
    const outbox = await owner.select().from(outboxEvent).where(eq(outboxEvent.storeId, storeId))
    expect(outbox).toHaveLength(1)
    expect(outbox[0]).toMatchObject({ type: 'order.paid', payload: { orderId } })
  })

  it('acknowledges an event for an unknown reference without applying anything', async () => {
    const { storeId } = await seedOrder()
    const p = scripted({ captured: { eventId: 'evt_9', providerRef: 'ref_unknown' } })
    const r = await withStore(app, storeId, (tx) =>
      handlePaymentWebhook({ storeId, tx }, p, { rawBody: 'captured', headers: { sig: 'good' } }),
    )
    expect(r).toMatchObject({ ok: true, applied: false, duplicate: false })
  })
})
