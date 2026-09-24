import { createHmac } from 'node:crypto'
import { describePaymentProvider } from '@commerce/payments/testing'
import { describe, expect, it, vi } from 'vitest'
import {
  buildDisplayConfig,
  buildOrderNotes,
  buildReceipt,
  RazorpayProvider,
  razorpayFactory,
} from '../src/razorpay'

const live = Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET)
const config = {
  keyId: process.env.RAZORPAY_KEY_ID ?? 'rzp_test_offline',
  keySecret: process.env.RAZORPAY_KEY_SECRET ?? 'offline-secret',
  webhookSecret: 'whsec_test',
}

const capturedBody = JSON.stringify({
  event: 'payment.captured',
  payload: {
    payment: {
      entity: {
        id: 'pay_123',
        order_id: 'order_abc',
        amount: 269900,
        status: 'captured',
        notes: { orderId: '01a0-order' },
      },
    },
  },
})
const sign = (body: string) => createHmac('sha256', config.webhookSecret).update(body).digest('hex')

describePaymentProvider('razorpay', {
  create: () => new RazorpayProvider(config),
  amountPaise: 100,
  live,
  webhooks: {
    valid: {
      rawBody: capturedBody,
      headers: { 'x-razorpay-signature': sign(capturedBody), 'x-razorpay-event-id': 'evt_1' },
    },
    tampered: {
      rawBody: capturedBody.replace('269900', '1'),
      headers: { 'x-razorpay-signature': sign(capturedBody) },
    },
  },
})

describe('razorpay specifics', () => {
  const p = new RazorpayProvider(config)

  it('normalises payment.captured with our order id from notes', () => {
    const r = p.parseWebhook({
      rawBody: capturedBody,
      headers: { 'x-razorpay-signature': sign(capturedBody), 'x-razorpay-event-id': 'evt_1' },
    })
    expect(r.ok && r.event).toMatchObject({
      type: 'payment.captured',
      providerRef: 'order_abc',
      providerPaymentId: 'pay_123',
      amountPaise: 269900,
      orderId: '01a0-order',
    })
    expect(r.ok && r.eventId).toBe('evt_1')
  })

  it('marks unknown events as ignored rather than failing', () => {
    const body = JSON.stringify({ event: 'subscription.charged', payload: {} })
    const r = p.parseWebhook({ rawBody: body, headers: { 'x-razorpay-signature': sign(body) } })
    expect(r.ok && r.event.type).toBe('ignored')
  })

  it('rejects a client confirmation whose signature does not match', async () => {
    const r = await p.confirm('order_abc', {
      razorpay_payment_id: 'pay_123',
      razorpay_signature: 'nope',
    })
    expect(r.status).toBe('failed')
  })

  it('validates config', () => {
    expect(razorpayFactory.validateConfig({}).ok).toBe(false)
    expect(razorpayFactory.validateConfig(config).ok).toBe(true)
  })

  it('reads enableEmi from a form string', () => {
    const r = razorpayFactory.validateConfig({ ...config, enableEmi: 'true' })
    expect(r.ok && r.config.enableEmi).toBe(true)
    const off = razorpayFactory.validateConfig(config)
    expect(off.ok && off.config.enableEmi).toBe(false)
  })
})

describe('order notes', () => {
  const base = { orderId: 'o1', amountPaise: 100, currency: 'INR' as const, customer: {} }

  it('flattens shipping and basket, skips absent fields', () => {
    const notes = buildOrderNotes({
      ...base,
      orderNumber: 7,
      shipping: {
        name: 'Asha',
        line1: '12 MG Road',
        city: 'Pune',
        state: 'MH',
        postalCode: '411001',
        country: 'IN',
      },
      lines: [{ title: 'Mouse', quantity: 2, unitPricePaise: 149900 }],
    })
    expect(notes).toEqual({
      orderId: 'o1',
      orderNumber: '7',
      shipping_name: 'Asha',
      shipping_line1: '12 MG Road',
      shipping_city: 'Pune',
      shipping_state: 'MH',
      shipping_postal_code: '411001',
      shipping_country: 'IN',
      basket: '2x Mouse @1499.00',
    })
  })

  it('clips every value to 256 characters and never exceeds 15 keys', () => {
    const notes = buildOrderNotes({
      ...base,
      lines: Array.from({ length: 40 }, (_, i) => ({
        title: `Item ${i}`,
        quantity: 1,
        unitPricePaise: 100,
      })),
    })
    expect(notes.basket?.length).toBe(256)
    expect(Object.keys(notes).length).toBeLessThanOrEqual(15)
  })
})

describe('display config', () => {
  it('keeps defaults only when EMI is off', () => {
    expect(buildDisplayConfig(false)).toEqual({
      display: { preferences: { show_default_blocks: true } },
    })
  })

  it('leads with a Snapmint cardless EMI block when EMI is on', () => {
    const c = buildDisplayConfig(true) as {
      display: { blocks: { emi: { instruments: unknown[] } }; sequence: string[] }
    }
    expect(c.display.sequence).toEqual(['block.emi'])
    expect(c.display.blocks.emi.instruments[0]).toEqual({
      method: 'cardless_emi',
      providers: ['snapmint'],
    })
  })
})

describe('payment attempts', () => {
  const base = { orderId: 'o1', amountPaise: 100, currency: 'INR' as const, customer: {} }

  it('puts the attempt number in the receipt, capped at 40 characters', () => {
    expect(buildReceipt({ ...base, orderNumber: 42, idempotencyKey: 'o1:1' })).toBe('order-42')
    expect(buildReceipt({ ...base, orderNumber: 42, idempotencyKey: 'o1:3' })).toBe('order-42-3')
    expect(buildReceipt({ ...base, orderId: 'x'.repeat(60) })).toHaveLength(40)
  })

  it('sends the key in notes and receipt without calling the real API', async () => {
    const p = new RazorpayProvider(config)
    const create = vi.fn(async (body: Record<string, unknown>) => ({ id: 'order_m1', ...body }))
    // Mock the HTTP client: nothing leaves the machine.
    const client = (p as unknown as { client: { orders: { create: typeof create } } }).client
    client.orders.create = create
    const r = await p.createPayment({ ...base, orderNumber: 9, idempotencyKey: 'o1:2' })
    expect(r.providerRef).toBe('order_m1')
    expect(create).toHaveBeenCalledTimes(1)
    expect(create.mock.calls[0]?.[0]).toMatchObject({
      receipt: 'order-9-2',
      notes: { orderId: 'o1', idempotencyKey: 'o1:2' },
    })
  })

  it('echoes the key from payment notes on webhooks', () => {
    const body = JSON.stringify({
      event: 'payment.failed',
      payload: {
        payment: {
          entity: {
            id: 'pay_9',
            order_id: 'order_m1',
            amount: 100,
            status: 'failed',
            notes: { orderId: 'o1', idempotencyKey: 'o1:2' },
          },
        },
      },
    })
    const r = new RazorpayProvider(config).parseWebhook({
      rawBody: body,
      headers: { 'x-razorpay-signature': sign(body), 'x-razorpay-event-id': 'evt_9' },
    })
    expect(r.ok && r.event).toMatchObject({ type: 'payment.failed', idempotencyKey: 'o1:2' })
  })
})
