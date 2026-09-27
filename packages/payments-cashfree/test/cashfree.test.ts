import { createHmac } from 'node:crypto'
import { describePaymentProvider } from '@commerce/payments/testing'
import { describe, expect, it, vi } from 'vitest'
import {
  buildCashfreeOrderId,
  CASHFREE_METHOD_CODES,
  CASHFREE_WEBHOOK_TOLERANCE_MS,
  CashfreeProvider,
  cashfreeFactory,
} from '../src/cashfree'

const config = { appId: 'cf_test_app', secretKey: 'cf_test_secret', mode: 'test' as const }

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

const paymentSuccessBody = JSON.stringify({
  type: 'PAYMENT_SUCCESS_WEBHOOK',
  event_time: '2026-01-01T00:00:00+05:30',
  data: {
    order: {
      order_id: 'o7_1a2b3c4d_1',
      order_amount: 2699,
      order_currency: 'INR',
      order_tags: { orderId: '01a0-order', orderNumber: '7', idempotencyKey: '01a0-order:1' },
    },
    payment: {
      cf_payment_id: 998877,
      payment_status: 'SUCCESS',
      payment_amount: 2699,
      payment_currency: 'INR',
      payment_message: 'ok',
      payment_time: '2026-01-01T00:00:00+05:30',
      payment_group: 'upi',
    },
    customer_details: {},
  },
})

/** Cashfree sends milliseconds; signed "now" so the replay window accepts it. */
const ts = String(Date.now())

const sign = (timestamp: string, body: string) =>
  createHmac('sha256', config.secretKey).update(`${timestamp}${body}`).digest('base64')

describePaymentProvider('cashfree', {
  create: () => new CashfreeProvider(config, vi.fn() as unknown as typeof fetch),
  amountPaise: 100,
  live: false,
  webhooks: {
    valid: {
      rawBody: paymentSuccessBody,
      headers: {
        'x-webhook-signature': sign(ts, paymentSuccessBody),
        'x-webhook-timestamp': ts,
      },
    },
    tampered: {
      rawBody: paymentSuccessBody.replace('998877', '1'),
      headers: {
        'x-webhook-signature': sign(ts, paymentSuccessBody),
        'x-webhook-timestamp': ts,
      },
    },
  },
})

describe('buildCashfreeOrderId', () => {
  it('combines order number, id fragment and attempt, sanitised', () => {
    const id = buildCashfreeOrderId({
      orderId: '01a0bcde-1234-5678-9abc-def012345678',
      orderNumber: 7,
      amountPaise: 100,
      currency: 'INR',
      customer: {},
      idempotencyKey: '01a0bcde-...:2',
    })
    expect(id).toBe('o7_01a0bcde_2')
  })

  it('defaults to attempt 1 with no idempotency key and no order number', () => {
    const id = buildCashfreeOrderId({
      orderId: 'ffffffff-0000-0000-0000-000000000000',
      amountPaise: 100,
      currency: 'INR',
      customer: {},
    })
    expect(id).toBe('o_ffffffff_1')
  })

  it('never exceeds 45 characters and only uses allowed characters', () => {
    const id = buildCashfreeOrderId({
      orderId: 'x'.repeat(60),
      orderNumber: 123456789,
      amountPaise: 100,
      currency: 'INR',
      customer: {},
      idempotencyKey: 'k:999999999999999',
    })
    expect(id.length).toBeLessThanOrEqual(45)
    expect(id).toMatch(/^[A-Za-z0-9_-]+$/)
  })
})

describe('createPayment', () => {
  const base = {
    orderId: '01a0bcde-1234-5678-9abc-def012345678',
    orderNumber: 7,
    amountPaise: 269900,
    currency: 'INR' as const,
    customer: { phone: '+91 98765-43210', email: 'asha@example.com', name: 'Asha' },
    idempotencyKey: '01a0bcde-1234-5678-9abc-def012345678:1',
  }

  it('posts the order with rupees, headers and tags', async () => {
    const fetchImpl = vi.fn(async (url: string, init: RequestInit) => {
      expect(url).toBe('https://sandbox.cashfree.com/pg/orders')
      const headers = init.headers as Record<string, string>
      expect(headers['x-client-id']).toBe('cf_test_app')
      expect(headers['x-client-secret']).toBe('cf_test_secret')
      expect(headers['x-api-version']).toBe('2026-01-01')
      expect(headers['x-idempotency-key']).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      )
      const body = JSON.parse(init.body as string)
      expect(body.order_amount).toBe(2699)
      expect(body.order_currency).toBe('INR')
      expect(body.customer_details.customer_phone).toBe('9876543210')
      expect(body.customer_details.customer_id).toBe('c9876543210')
      expect(body.order_tags).toMatchObject({ orderId: base.orderId, orderNumber: '7' })
      return jsonResponse(200, {
        cf_order_id: 1,
        order_id: 'o7_01a0bcde_1',
        payment_session_id: 'session_abc',
        order_status: 'ACTIVE',
      })
    })
    const p = new CashfreeProvider(config, fetchImpl as unknown as typeof fetch)
    const r = await p.createPayment(base)
    expect(r.providerRef).toBe('o7_01a0bcde_1')
    expect(r.session).toMatchObject({
      kind: 'client',
      provider: 'cashfree',
      providerRef: 'o7_01a0bcde_1',
      publicKey: 'cf_test_app',
      options: { paymentSessionId: 'session_abc', mode: 'sandbox', orderId: 'o7_01a0bcde_1' },
    })
  })

  it('sends payment_methods in the order given, mapped through CASHFREE_METHOD_CODES', async () => {
    const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string)
      expect(body.order_meta.payment_methods).toBe(
        [...CASHFREE_METHOD_CODES.upi, ...CASHFREE_METHOD_CODES.card].join(','),
      )
      return jsonResponse(200, {
        cf_order_id: 1,
        order_id: 'o7_01a0bcde_1',
        payment_session_id: 'session_abc',
        order_status: 'ACTIVE',
      })
    })
    const p = new CashfreeProvider(config, fetchImpl as unknown as typeof fetch)
    await p.createPayment({ ...base, methods: ['upi', 'card'] })
  })

  it('leaves out an http notify_url; Cashfree only takes https', async () => {
    const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string)
      expect(body.order_meta?.notify_url).toBeUndefined()
      return new Response(
        JSON.stringify({ order_id: 'x', payment_session_id: 's', order_status: 'ACTIVE' }),
        { status: 200 },
      )
    })
    const p = new CashfreeProvider(
      { ...config, notifyUrl: 'http://localhost:4100/webhooks/payments/cashfree/s1' },
      fetchImpl as unknown as typeof fetch,
    )
    await p.createPayment(base)
    expect(fetchImpl).toHaveBeenCalledOnce()
  })

  it('sends the configured notify_url, skipping it past 250 characters', async () => {
    const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string)
      expect(body.order_meta.notify_url).toBe('https://store.example.com/webhooks/cashfree')
      return jsonResponse(200, {
        cf_order_id: 1,
        order_id: 'o7_01a0bcde_1',
        payment_session_id: 'session_abc',
        order_status: 'ACTIVE',
      })
    })
    const p = new CashfreeProvider(
      { ...config, notifyUrl: 'https://store.example.com/webhooks/cashfree' },
      fetchImpl as unknown as typeof fetch,
    )
    await p.createPayment(base)

    const longUrlFetch = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string)
      expect(body.order_meta?.notify_url).toBeUndefined()
      return jsonResponse(200, {
        cf_order_id: 1,
        order_id: 'o7_01a0bcde_1',
        payment_session_id: 'session_abc',
        order_status: 'ACTIVE',
      })
    })
    const longUrl = `https://store.example.com/${'x'.repeat(240)}`
    const p2 = new CashfreeProvider(
      { ...config, notifyUrl: longUrl },
      longUrlFetch as unknown as typeof fetch,
    )
    await p2.createPayment(base)
  })

  it('throws without a usable phone number', async () => {
    const p = new CashfreeProvider(config, vi.fn() as unknown as typeof fetch)
    await expect(
      p.createPayment({ ...base, customer: { email: 'x@example.com' } }),
    ).rejects.toThrow('Cashfree needs a 10-digit phone number')
  })
})

describe('fetchStatus', () => {
  it('maps PAID with a captured payment id', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      if (url.endsWith('/payments')) {
        return jsonResponse(200, [
          { cf_payment_id: 55, payment_status: 'SUCCESS', payment_amount: 2699 },
        ])
      }
      return jsonResponse(200, { order_status: 'PAID', order_amount: 2699, cf_order_id: 1 })
    })
    const p = new CashfreeProvider(config, fetchImpl as unknown as typeof fetch)
    const s = await p.fetchStatus('o7_01a0bcde_1')
    expect(s).toEqual({ status: 'captured', providerPaymentId: '55', amountPaise: 269900 })
  })

  const activeWith = (payments: unknown[]) =>
    vi.fn(async (url: string) =>
      url.endsWith('/payments')
        ? jsonResponse(200, payments)
        : jsonResponse(200, { order_status: 'ACTIVE', order_amount: 2699, cf_order_id: 1 }),
    )

  it('maps ACTIVE with no payment yet to pending', async () => {
    const p = new CashfreeProvider(config, activeWith([]) as unknown as typeof fetch)
    const s = await p.fetchStatus('o7_01a0bcde_1')
    expect(s.status).toBe('pending')
  })

  it('keeps PENDING and NOT_ATTEMPTED payments pending', async () => {
    for (const status of ['PENDING', 'NOT_ATTEMPTED']) {
      const fetchImpl = activeWith([
        { cf_payment_id: 7, payment_status: status, payment_amount: 2699 },
      ])
      const p = new CashfreeProvider(config, fetchImpl as unknown as typeof fetch)
      expect((await p.fetchStatus('o7_01a0bcde_1')).status).toBe('pending')
    }
  })

  it('maps FAILED, USER_DROPPED, VOID and CANCELLED payments to failed', async () => {
    for (const status of ['FAILED', 'USER_DROPPED', 'VOID', 'CANCELLED']) {
      const fetchImpl = activeWith([
        { cf_payment_id: 8, payment_status: status, payment_amount: 2699 },
      ])
      const p = new CashfreeProvider(config, fetchImpl as unknown as typeof fetch)
      const s = await p.fetchStatus('o7_01a0bcde_1')
      expect(s).toEqual({ status: 'failed', providerPaymentId: '8', amountPaise: 269900 })
    }
  })

  it('judges by the latest payment, and a success anywhere wins', async () => {
    const retried = activeWith([
      {
        cf_payment_id: 1,
        payment_status: 'FAILED',
        payment_amount: 2699,
        payment_time: '2026-09-26T10:00:00+05:30',
      },
      {
        cf_payment_id: 2,
        payment_status: 'PENDING',
        payment_amount: 2699,
        payment_time: '2026-09-26T10:02:00+05:30',
      },
    ])
    let p = new CashfreeProvider(config, retried as unknown as typeof fetch)
    expect((await p.fetchStatus('o7_01a0bcde_1')).status).toBe('pending')
    const paid = activeWith([
      { cf_payment_id: 3, payment_status: 'FAILED', payment_amount: 2699 },
      { cf_payment_id: 4, payment_status: 'SUCCESS', payment_amount: 2699 },
    ])
    p = new CashfreeProvider(config, paid as unknown as typeof fetch)
    expect(await p.fetchStatus('o7_01a0bcde_1')).toEqual({
      status: 'captured',
      providerPaymentId: '4',
      amountPaise: 269900,
    })
  })

  it('maps EXPIRED to failed', async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(200, { order_status: 'EXPIRED', order_amount: 2699, cf_order_id: 1 }),
    )
    const p = new CashfreeProvider(config, fetchImpl as unknown as typeof fetch)
    const s = await p.fetchStatus('o7_01a0bcde_1')
    expect(s.status).toBe('failed')
  })
})

describe('refund', () => {
  it('posts rupees to the order reference and maps status', async () => {
    const fetchImpl = vi.fn(async (url: string, init: RequestInit) => {
      expect(url).toBe('https://sandbox.cashfree.com/pg/orders/o7_01a0bcde_1/refunds')
      const body = JSON.parse(init.body as string)
      expect(body.refund_amount).toBe(100)
      expect(body.refund_id).toMatch(/^[A-Za-z0-9]{3,40}$/)
      return jsonResponse(200, {
        cf_refund_id: 42,
        refund_id: body.refund_id,
        refund_amount: 100,
        refund_status: 'SUCCESS',
      })
    })
    const p = new CashfreeProvider(config, fetchImpl as unknown as typeof fetch)
    const r = await p.refund('pay_1', 10000, 'store credit', { providerRef: 'o7_01a0bcde_1' })
    expect(r).toEqual({ providerRefundId: '42', status: 'processed' })
  })

  it('sends the refund key as an alphanumeric refund_id with the note', async () => {
    const fetchImpl = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(init.body as string)
      expect(body).toEqual({
        refund_amount: 250.5,
        refund_id: 'ref01a0order2',
        refund_note: 'Damaged in transit',
      })
      return jsonResponse(200, {
        cf_refund_id: 43,
        refund_id: body.refund_id,
        refund_amount: 250.5,
        refund_status: 'PENDING',
      })
    })
    const p = new CashfreeProvider(config, fetchImpl as unknown as typeof fetch)
    const r = await p.refund('pay_1', 25050, 'Damaged in transit', {
      providerRef: 'o7_01a0bcde_1',
      refundKey: 'ref:01a0-order:2',
    })
    expect(r).toEqual({ providerRefundId: '43', status: 'pending' })
  })

  it('throws without a provider reference', async () => {
    const p = new CashfreeProvider(config, vi.fn() as unknown as typeof fetch)
    await expect(p.refund('pay_1', 10000)).rejects.toThrow(
      'Cashfree refunds need the order reference',
    )
  })
})

describe('parseWebhook', () => {
  it('normalises a payment success webhook', () => {
    const p = new CashfreeProvider(config)
    const r = p.parseWebhook({
      rawBody: paymentSuccessBody,
      headers: {
        'x-webhook-signature': sign(ts, paymentSuccessBody),
        'x-webhook-timestamp': ts,
      },
    })
    expect(r.ok && r.event).toMatchObject({
      type: 'payment.captured',
      providerRef: 'o7_1a2b3c4d_1',
      providerPaymentId: '998877',
      amountPaise: 269900,
      orderId: '01a0-order',
      idempotencyKey: '01a0-order:1',
    })
  })

  it('falls back to type:cf_payment_id for the event id', () => {
    const p = new CashfreeProvider(config)
    const r = p.parseWebhook({
      rawBody: paymentSuccessBody,
      headers: {
        'x-webhook-signature': sign(ts, paymentSuccessBody),
        'x-webhook-timestamp': ts,
      },
    })
    expect(r.ok && r.eventId).toBe('PAYMENT_SUCCESS_WEBHOOK:998877')
  })

  it('normalises a payment failed webhook', () => {
    const body = JSON.stringify({
      type: 'PAYMENT_FAILED_WEBHOOK',
      data: {
        order: { order_id: 'o7_1', order_amount: 2699, order_currency: 'INR' },
        payment: {
          cf_payment_id: 1,
          payment_status: 'FAILED',
          payment_amount: 2699,
          payment_message: 'Insufficient funds',
        },
      },
    })
    const p = new CashfreeProvider(config)
    const r = p.parseWebhook({
      rawBody: body,
      headers: {
        'x-webhook-signature': sign(ts, body),
        'x-webhook-timestamp': ts,
      },
    })
    expect(r.ok && r.event).toMatchObject({
      type: 'payment.failed',
      providerRef: 'o7_1',
      reason: 'Insufficient funds',
    })
  })

  it('ignores a user-dropped webhook', () => {
    const body = JSON.stringify({ type: 'PAYMENT_USER_DROPPED_WEBHOOK', data: {} })
    const p = new CashfreeProvider(config)
    const r = p.parseWebhook({
      rawBody: body,
      headers: {
        'x-webhook-signature': sign(ts, body),
        'x-webhook-timestamp': ts,
      },
    })
    expect(r.ok && r.event.type).toBe('ignored')
  })

  it('normalises a successful refund webhook, reading type from the top level', () => {
    const body = JSON.stringify({
      type: 'REFUND_STATUS_WEBHOOK',
      data: {
        type: 'REFUND_STATUS_WEBHOOK',
        refund: {
          cf_refund_id: 42,
          cf_payment_id: 998877,
          refund_id: 'rf_1',
          order_id: 'o7_1',
          refund_amount: 100,
          refund_status: 'SUCCESS',
        },
      },
    })
    const p = new CashfreeProvider(config)
    const r = p.parseWebhook({
      rawBody: body,
      headers: {
        'x-webhook-signature': sign(ts, body),
        'x-webhook-timestamp': ts,
      },
    })
    expect(r.ok && r.event).toMatchObject({
      type: 'refund.processed',
      providerRef: 'o7_1',
      providerRefundId: '42',
      amountPaise: 10000,
    })
  })

  it('ignores a non-success refund webhook', () => {
    const body = JSON.stringify({
      type: 'REFUND_STATUS_WEBHOOK',
      data: {
        refund: {
          cf_refund_id: 42,
          refund_id: 'rf_1',
          order_id: 'o7_1',
          refund_amount: 100,
          refund_status: 'PENDING',
        },
      },
    })
    const p = new CashfreeProvider(config)
    const r = p.parseWebhook({
      rawBody: body,
      headers: {
        'x-webhook-signature': sign(ts, body),
        'x-webhook-timestamp': ts,
      },
    })
    expect(r.ok && r.event.type).toBe('ignored')
  })

  it('rejects a bad signature', () => {
    const p = new CashfreeProvider(config)
    const r = p.parseWebhook({
      rawBody: paymentSuccessBody,
      headers: { 'x-webhook-signature': 'nope', 'x-webhook-timestamp': ts },
    })
    expect(r.ok).toBe(false)
  })

  it('rejects missing headers', () => {
    const p = new CashfreeProvider(config)
    expect(p.parseWebhook({ rawBody: paymentSuccessBody, headers: {} }).ok).toBe(false)
  })

  it('rejects invalid json', () => {
    const p = new CashfreeProvider(config)
    const r = p.parseWebhook({
      rawBody: 'not json',
      headers: {
        'x-webhook-signature': sign(ts, 'not json'),
        'x-webhook-timestamp': ts,
      },
    })
    expect(r).toEqual({ ok: false, reason: 'invalid json' })
  })

  it('rejects a correctly signed webhook older than the replay window', () => {
    const p = new CashfreeProvider(config)
    const old = String(Date.now() - CASHFREE_WEBHOOK_TOLERANCE_MS - 60_000)
    const r = p.parseWebhook({
      rawBody: paymentSuccessBody,
      headers: {
        'x-webhook-signature': sign(old, paymentSuccessBody),
        'x-webhook-timestamp': old,
      },
    })
    expect(r).toEqual({ ok: false, reason: 'stale timestamp' })
  })

  it('rejects a correctly signed webhook dated too far in the future', () => {
    const p = new CashfreeProvider(config)
    const future = String(Date.now() + CASHFREE_WEBHOOK_TOLERANCE_MS + 60_000)
    const r = p.parseWebhook({
      rawBody: paymentSuccessBody,
      headers: {
        'x-webhook-signature': sign(future, paymentSuccessBody),
        'x-webhook-timestamp': future,
      },
    })
    expect(r).toEqual({ ok: false, reason: 'stale timestamp' })
  })

  it('rejects a signed timestamp that is not a number', () => {
    const p = new CashfreeProvider(config)
    const r = p.parseWebhook({
      rawBody: paymentSuccessBody,
      headers: {
        'x-webhook-signature': sign('yesterday', paymentSuccessBody),
        'x-webhook-timestamp': 'yesterday',
      },
    })
    expect(r).toEqual({ ok: false, reason: 'stale timestamp' })
  })

  it('also reads a timestamp in seconds', () => {
    const p = new CashfreeProvider(config)
    const seconds = String(Math.floor(Date.now() / 1000))
    const r = p.parseWebhook({
      rawBody: paymentSuccessBody,
      headers: {
        'x-webhook-signature': sign(seconds, paymentSuccessBody),
        'x-webhook-timestamp': seconds,
      },
    })
    expect(r.ok).toBe(true)
  })

  it('rejects a signature made with a different secret', () => {
    const p = new CashfreeProvider(config)
    const other = createHmac('sha256', 'someone_else')
      .update(`${ts}${paymentSuccessBody}`)
      .digest('base64')
    const r = p.parseWebhook({
      rawBody: paymentSuccessBody,
      headers: { 'x-webhook-signature': other, 'x-webhook-timestamp': ts },
    })
    expect(r).toEqual({ ok: false, reason: 'bad signature' })
  })
})

describe('testConnection', () => {
  it('treats a 404 as valid keys', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(404, { message: 'no such order' }))
    const p = new CashfreeProvider(config, fetchImpl as unknown as typeof fetch)
    const r = await p.testConnection()
    expect(r.ok).toBe(true)
  })

  it('treats a 401 as bad keys', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(401, { message: 'authentication Failed' }))
    const p = new CashfreeProvider(config, fetchImpl as unknown as typeof fetch)
    const r = await p.testConnection()
    expect(r.ok).toBe(false)
    expect(r.message).toMatch(/App ID and Secret key/)
  })

  it('surfaces other failures without throwing', async () => {
    const fetchImpl = vi.fn(async () => jsonResponse(500, { message: 'server error' }))
    const p = new CashfreeProvider(config, fetchImpl as unknown as typeof fetch)
    const r = await p.testConnection()
    expect(r.ok).toBe(false)
    expect(r.message).toMatch(/server error/)
  })
})

describe('validateConfig', () => {
  it('requires appId and secretKey', () => {
    expect(cashfreeFactory.validateConfig({}).ok).toBe(false)
    expect(cashfreeFactory.validateConfig(config).ok).toBe(true)
  })

  it('defaults mode to test unless exactly live', () => {
    const r = cashfreeFactory.validateConfig({ ...config, mode: 'nonsense' })
    expect(r.ok && r.config.mode).toBe('test')
    const live = cashfreeFactory.validateConfig({ ...config, mode: 'live' })
    expect(live.ok && live.config.mode).toBe('live')
  })

  it('hides mode and notifyUrl — the admin writes them, merchants never fill them in', () => {
    const modeField = cashfreeFactory.fields.find((f) => f.key === 'mode')
    const notifyUrlField = cashfreeFactory.fields.find((f) => f.key === 'notifyUrl')
    expect(modeField?.hidden).toBe(true)
    expect(notifyUrlField?.hidden).toBe(true)
  })

  it('carries notifyUrl through into the config', () => {
    const r = cashfreeFactory.validateConfig({
      ...config,
      notifyUrl: 'https://store.example.com/webhooks/cashfree',
    })
    expect(r.ok && r.config.notifyUrl).toBe('https://store.example.com/webhooks/cashfree')
  })
})

describe('sandbox and production', () => {
  const order = {
    orderId: '01a0bcde-1234-5678-9abc-def012345678',
    orderNumber: 7,
    amountPaise: 100,
    currency: 'INR' as const,
    customer: { phone: '9876543210' },
  }
  const created = {
    cf_order_id: 1,
    order_id: 'o7_01a0bcde_1',
    payment_session_id: 'session_abc',
    order_status: 'ACTIVE',
  }

  for (const [mode, host, checkoutMode] of [
    ['test', 'https://sandbox.cashfree.com/pg', 'sandbox'],
    ['live', 'https://api.cashfree.com/pg', 'production'],
  ] as const) {
    it(`${mode} mode calls ${host} for every request`, async () => {
      const urls: string[] = []
      const fetchImpl = vi.fn(async (url: string) => {
        urls.push(url)
        if (url.endsWith('/orders')) return jsonResponse(200, created)
        if (url.endsWith('/payments')) return jsonResponse(200, [])
        if (url.endsWith('/refunds')) {
          return jsonResponse(200, {
            cf_refund_id: 1,
            refund_id: 'r1',
            refund_amount: 1,
            refund_status: 'PENDING',
          })
        }
        if (url.includes('connection-test')) return jsonResponse(404, { message: 'not found' })
        return jsonResponse(200, { order_status: 'ACTIVE', order_amount: 1, cf_order_id: 1 })
      })
      const p = new CashfreeProvider({ ...config, mode }, fetchImpl as unknown as typeof fetch)

      const r = await p.createPayment(order)
      await p.fetchStatus('o7_01a0bcde_1')
      await p.refund('pay_1', 100, undefined, { providerRef: 'o7_01a0bcde_1' })
      expect((await p.testConnection()).ok).toBe(true)

      expect(urls.length).toBeGreaterThanOrEqual(4)
      for (const url of urls) expect(url.startsWith(`${host}/`)).toBe(true)
      expect(r.session).toMatchObject({ options: { mode: checkoutMode } })
    })
  }

  it('a live connection test with test keys reads as bad keys', async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      expect(url.startsWith('https://api.cashfree.com/pg/orders/connection-test-')).toBe(true)
      return jsonResponse(401, { message: 'authentication Failed' })
    })
    const p = new CashfreeProvider(
      { ...config, mode: 'live' },
      fetchImpl as unknown as typeof fetch,
    )
    const r = await p.testConnection()
    expect(r.ok).toBe(false)
    expect(r.message).toMatch(/Test or Live/)
  })
})
