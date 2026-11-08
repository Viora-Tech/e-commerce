import { createHmac } from 'node:crypto'
import { describePaymentProvider } from '@commerce/payments/testing'
import { describe, expect, it, vi } from 'vitest'
import {
  buildDisplayConfig,
  buildMethodDisplayConfig,
  buildOrderNotes,
  buildReceipt,
  RazorpayProvider,
  razorpayFactory,
  razorpayMode,
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
    expect(r.ok && r.eventId).toBe('payment.captured:pay_123')
  })

  it('dedupes on the signed body, not the unsigned event-id header', () => {
    const parse = (eventHeader: string) =>
      p.parseWebhook({
        rawBody: capturedBody,
        headers: { 'x-razorpay-signature': sign(capturedBody), 'x-razorpay-event-id': eventHeader },
      })
    const a = parse('evt_1')
    const b = parse('evt_replayed')
    expect(a.ok && b.ok && a.eventId === b.eventId).toBe(true)
  })

  it('ignores a payment made outside our checkout (no Razorpay order)', () => {
    const body = JSON.stringify({
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_rogue',
            order_id: null,
            amount: 100,
            status: 'captured',
            notes: { idempotencyKey: '01a0-order:1' },
          },
        },
      },
    })
    const r = p.parseWebhook({ rawBody: body, headers: { 'x-razorpay-signature': sign(body) } })
    expect(r.ok && r.event.type).toBe('ignored')
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

  it('names a checkout draft by its draft number and sends its id in notes', () => {
    expect(buildReceipt({ ...base, draftNumber: 57, idempotencyKey: 'o1:2' })).toBe('draft-D57-2')
    const notes = buildOrderNotes({ ...base, draftNumber: 57 })
    expect(notes.draft_id).toBe('o1')
    expect(notes.draftNumber).toBe('D57')
    expect(notes.orderNumber).toBeUndefined()
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

describe('failed payments', () => {
  const failed = (entity: Record<string, unknown>) => {
    const body = JSON.stringify({
      event: 'payment.failed',
      payload: {
        payment: {
          entity: { id: 'pay_f1', order_id: 'order_f1', amount: 100, status: 'failed', ...entity },
        },
      },
    })
    const r = new RazorpayProvider(config).parseWebhook({
      rawBody: body,
      headers: { 'x-razorpay-signature': sign(body), 'x-razorpay-event-id': 'evt_f1' },
    })
    return r.ok && r.event.type === 'payment.failed' ? r.event.reason : null
  }

  it("carries Razorpay's description and reason through, as on the Waimers website block", () => {
    expect(
      failed({
        error_code: 'BAD_REQUEST_ERROR',
        error_description: 'Payment blocked as website does not match registered website(s)',
        error_source: 'internal',
        error_step: 'payment_initiation',
        error_reason: 'payment_risk_check_failed',
      }),
    ).toBe(
      'Payment blocked as website does not match registered website(s) (payment_risk_check_failed)',
    )
  })

  it('falls back to the code, then a plain line, when the description is missing', () => {
    expect(failed({ error_code: 'GATEWAY_ERROR' })).toBe('GATEWAY_ERROR')
    expect(failed({})).toBe('Payment failed')
    expect(failed({ error_description: 'Card declined' })).toBe('Card declined')
  })
})

describe('merchant method row', () => {
  const base = { orderId: 'o1', amountPaise: 100, currency: 'INR' as const, customer: {} }

  it('shows only the methods turned on, in their order, without default blocks', () => {
    const c = buildMethodDisplayConfig(['card', 'upi', 'emi']) as {
      display: {
        blocks: Record<string, { instruments: Record<string, unknown>[] }>
        sequence: string[]
        preferences: { show_default_blocks: boolean }
      }
    }
    expect(c.display.sequence).toEqual(['block.card', 'block.upi', 'block.emi'])
    expect(Object.keys(c.display.blocks)).toEqual(['card', 'upi', 'emi'])
    expect(c.display.blocks.upi?.instruments).toEqual([{ method: 'upi' }])
    expect(c.display.blocks.emi?.instruments).toEqual([
      { method: 'cardless_emi', providers: ['snapmint'] },
      { method: 'emi' },
      { method: 'cardless_emi' },
      { method: 'paylater' },
    ])
    expect(c.display.preferences.show_default_blocks).toBe(false)
  })

  it('uses the method row in Checkout options when the order carries it', async () => {
    const p = new RazorpayProvider(config)
    const create = vi.fn(async () => ({ id: 'order_m2' }))
    const client = (p as unknown as { client: { orders: { create: typeof create } } }).client
    client.orders.create = create
    const r = await p.createPayment({ ...base, methods: ['netbanking'] })
    const options = r.session.kind === 'client' ? r.session.options : {}
    expect((options.config as { display: { sequence: string[] } }).display.sequence).toEqual([
      'block.netbanking',
    ])
  })

  it("keeps Razorpay's own window and the store's name when every method is on", async () => {
    const p = new RazorpayProvider({ ...config, displayName: undefined })
    const create = vi.fn(async () => ({ id: 'order_m3' }))
    const client = (p as unknown as { client: { orders: { create: typeof create } } }).client
    client.orders.create = create
    const r = await p.createPayment({
      ...base,
      merchantName: 'Waimers',
      methods: ['upi', 'card', 'netbanking', 'wallet', 'emi'],
    })
    const options = r.session.kind === 'client' ? r.session.options : {}
    expect(options.name).toBe('Waimers')
    expect(options.config).toEqual({ display: { preferences: { show_default_blocks: true } } })
  })

  it('reads test or live from the key id', () => {
    expect(razorpayMode('rzp_test_abc')).toBe('test')
    expect(razorpayMode('rzp_test_oauth_abc')).toBe('test')
    expect(razorpayMode('rzp_live_abc')).toBe('live')
    expect(razorpayMode('nope')).toBeNull()
  })
})

describe('test connection', () => {
  const withOrdersAll = (impl: () => Promise<unknown>) => {
    const p = new RazorpayProvider(config)
    const client = (p as unknown as { client: { orders: { all: () => Promise<unknown> } } }).client
    client.orders.all = vi.fn(impl)
    return p
  }

  it('passes when Razorpay lists orders', async () => {
    const r = await withOrdersAll(async () => ({ items: [] })).testConnection()
    expect(r.ok).toBe(true)
  })

  it('explains rejected keys in plain words', async () => {
    const r = await withOrdersAll(async () => {
      throw { statusCode: 401, error: { description: 'Authentication failed' } }
    }).testConnection()
    expect(r.ok).toBe(false)
    expect(r.message).toMatch(/didn't accept these keys/)
  })
})

describe('oauth connection', () => {
  const oauthConfig = {
    keyId: 'rzp_test_oauth_ABC',
    keySecret: '',
    webhookSecret: 'whsec_test',
    accessToken: 'at_1',
  }

  it('validates without a key secret when an access token is present', () => {
    expect(razorpayFactory.validateConfig(oauthConfig).ok).toBe(true)
    expect(razorpayFactory.validateConfig({ ...oauthConfig, accessToken: '' }).ok).toBe(false)
  })

  it('confirms by asking Razorpay, and only for a payment on this order', async () => {
    const p = new RazorpayProvider(oauthConfig)
    const fetchPayment = vi.fn(async (id: string) => ({
      id,
      order_id: 'order_abc',
      amount: 100,
      status: 'captured',
    }))
    const client = (p as unknown as { client: { payments: { fetch: typeof fetchPayment } } }).client
    client.payments.fetch = fetchPayment
    const ok = await p.confirm('order_abc', {
      razorpay_payment_id: 'pay_1',
      razorpay_signature: 'any',
    })
    expect(ok).toEqual({ status: 'captured', providerPaymentId: 'pay_1' })
    const other = await p.confirm('order_other', {
      razorpay_payment_id: 'pay_1',
      razorpay_signature: 'any',
    })
    expect(other.status).toBe('failed')
  })
})
