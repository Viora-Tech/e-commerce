import type { CreatePaymentInput, WebhookEvent } from '@commerce/payments'
import { describePaymentProvider } from '@commerce/payments/testing'
import { describe, expect, it, vi } from 'vitest'
import { snapmintChecksum, verifySnapmintChecksum } from '../src/checksum'
import { SnapmintProvider, snapmintFactory } from '../src/snapmint'
import { snapmintPaymentStatus } from '../src/status'

/** Made-up keys: never a real merchant's. */
const config = {
  merchantId: '12345',
  merchantKey: 'test-merchant-key',
  merchantToken: 'test-merchant-token',
  mode: 'test' as const,
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

/** A fetch that answers each call in turn and records what was asked. */
function mockFetch(...answers: (Response | Error)[]) {
  const calls: { url: string; init: RequestInit }[] = []
  const fn = vi.fn(async (url: string | URL, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} })
    const next = answers.shift()
    if (!next) throw new Error('unexpected fetch')
    if (next instanceof Error) throw next
    return next
  })
  return { fetch: fn as unknown as typeof fetch, calls }
}

const post = (over: Record<string, unknown> = {}) => {
  const base: Record<string, unknown> = {
    order_id: 'o1042_1a2b3c4d_2',
    order_value: 12345.5,
    snapmint_id: 2392821,
    status: 'success',
    full_name: 'Asha Verma',
    email: 'asha@example.com',
    ...over,
  }
  base.checksum_hash = snapmintChecksum(config, {
    status: String(base.status),
    orderId: String(base.order_id),
    orderValue: String(base.order_value),
    fullName: String(base.full_name),
    email: String(base.email),
  })
  return base
}

const validBody = JSON.stringify(post())

describePaymentProvider('snapmint', {
  create: () => new SnapmintProvider(config, vi.fn() as unknown as typeof fetch),
  live: false,
  webhooks: {
    valid: { rawBody: validBody, headers: {} },
    tampered: { rawBody: validBody.replace('12345.5', '1.5'), headers: {} },
  },
})

describe('checksum', () => {
  it('accepts a good checksum and refuses a changed field or wrong keys', () => {
    expect(verifySnapmintChecksum(config, post())).toBe(true)
    expect(verifySnapmintChecksum(config, { ...post(), status: 'failure' })).toBe(false)
    expect(verifySnapmintChecksum(config, { ...post(), order_value: 1 })).toBe(false)
    expect(verifySnapmintChecksum({ ...config, merchantKey: 'other' }, post())).toBe(false)
    expect(verifySnapmintChecksum(config, { ...post(), checksum_hash: 'abc' })).toBe(false)
    expect(verifySnapmintChecksum(config, { ...post(), checksum_hash: undefined })).toBe(false)
  })

  it('accepts the order value however Snapmint wrote it when hashing', () => {
    const hashedAs = (orderValue: string) =>
      snapmintChecksum(config, {
        status: 'success',
        orderId: 'o1',
        orderValue,
        fullName: 'A B',
        email: 'a@example.com',
      })
    const fields = { status: 'success', order_id: 'o1', full_name: 'A B', email: 'a@example.com' }
    // JSON drops the ".0" of 10000.0; the checksum may still have it.
    expect(
      verifySnapmintChecksum(config, {
        ...fields,
        order_value: 10000,
        checksum_hash: hashedAs('10000.0'),
      }),
    ).toBe(true)
    expect(
      verifySnapmintChecksum(config, {
        ...fields,
        order_value: '580.00',
        checksum_hash: hashedAs('580.00'),
      }),
    ).toBe(true)
  })

  it('reads a missing name or email as empty', () => {
    const hash = snapmintChecksum(config, {
      status: 'success',
      orderId: 'o1',
      orderValue: '10',
      fullName: '',
      email: '',
    })
    expect(
      verifySnapmintChecksum(config, {
        status: 'success',
        order_id: 'o1',
        order_value: '10',
        full_name: null,
        checksum_hash: hash,
      }),
    ).toBe(true)
  })
})

describe('status mapping', () => {
  it('maps every documented order status', () => {
    expect(snapmintPaymentStatus('CAPTURED')).toBe('captured')
    expect(snapmintPaymentStatus('SETTLED')).toBe('captured')
    expect(snapmintPaymentStatus('PARTIALLY_REFUNDED')).toBe('captured')
    expect(snapmintPaymentStatus('AUTHORIZED')).toBe('authorized')
    expect(snapmintPaymentStatus('REFUNDED')).toBe('refunded')
    expect(snapmintPaymentStatus('CANCELLED')).toBe('failed')
    expect(snapmintPaymentStatus('VOIDED')).toBe('failed')
    expect(snapmintPaymentStatus('ABANDONED')).toBe('failed')
    expect(snapmintPaymentStatus('PENDING_STATUS')).toBe('pending')
    expect(snapmintPaymentStatus('NOT_FOUND')).toBe('pending')
    expect(snapmintPaymentStatus('SOMETHING_NEW')).toBeNull()
  })
})

const payInput: CreatePaymentInput = {
  orderId: '1a2b3c4d-0000-4000-8000-000000000001',
  orderNumber: 1042,
  amountPaise: 1234550,
  currency: 'INR',
  idempotencyKey: '1a2b3c4d-0000-4000-8000-000000000001:2',
  customer: {
    name: 'Asha Verma',
    email: 'asha@example.com',
    phone: '9876543210',
    ip: '203.0.113.7',
  },
  shipping: {
    name: 'Asha Verma',
    line1: 'Flat 4',
    city: 'Pune',
    state: 'MH',
    postalCode: '411001',
    country: 'IN',
  },
  lines: [{ title: 'Kurta', quantity: 1, unitPricePaise: 1234550 }],
  storefrontOrigin: 'https://shop.example.in',
}

describe('createPayment', () => {
  it('posts the cart to the sandbox pay host without the token and redirects', async () => {
    const m = mockFetch(json(200, { url: 'https://pay.sandbox.snapmint.com?id=x&token=y' }))
    const r = await new SnapmintProvider(config, m.fetch).createPayment(payInput)
    expect(m.calls[0]?.url).toBe('https://apis.sandbox.snapmint.com/api/pub/carts')
    expect(m.calls[0]?.init.method).toBe('POST')
    const headers = (m.calls[0]?.init.headers ?? {}) as Record<string, string>
    expect(headers.authorization).toBeUndefined()
    const body = JSON.parse(String(m.calls[0]?.init.body))
    expect(body.orderValue).toBe('12345.50')
    expect(body.merchantId).toBe(12345)
    expect(r).toEqual({
      providerRef: 'o1042_1a2b3c4d_2',
      status: 'pending',
      session: {
        kind: 'redirect',
        provider: 'snapmint',
        providerRef: 'o1042_1a2b3c4d_2',
        url: 'https://pay.sandbox.snapmint.com?id=x&token=y',
      },
    })
  })

  it('uses the live host in live mode', async () => {
    const m = mockFetch(json(200, { url: 'https://pay.snapmint.com?id=x' }))
    await new SnapmintProvider({ ...config, mode: 'live' }, m.fetch).createPayment(payInput)
    expect(m.calls[0]?.url).toBe('https://pay.snapmint.com/api/pub/carts')
  })

  it("throws Snapmint's own code on a 400", async () => {
    const m = mockFetch(json(400, { code: 'DUPLICATE_MERCHANT_OID', message: 'duplicate' }))
    await expect(new SnapmintProvider(config, m.fetch).createPayment(payInput)).rejects.toThrow(
      /DUPLICATE_MERCHANT_OID/,
    )
  })
})

describe('order status', () => {
  it('asks with the bearer token and maps the answer', async () => {
    const m = mockFetch(
      json(200, { status: 'success', order_status: 'CAPTURED', snapmint_id: 2497 }),
    )
    const s = await new SnapmintProvider(config, m.fetch).fetchStatus('o1042_1a2b3c4d_2')
    expect(m.calls[0]?.url).toBe(
      'https://sandboxapi.snapmint.com/v1/merchants/orders/order_status?order_id=o1042_1a2b3c4d_2',
    )
    expect(((m.calls[0]?.init.headers ?? {}) as Record<string, string>).authorization).toBe(
      'Bearer test-merchant-token',
    )
    expect(s).toEqual({ status: 'captured', providerPaymentId: '2497', amountPaise: 0 })
  })

  it('reads a 404 as not paid yet', async () => {
    const m = mockFetch(json(404, { status: 'Error', message: 'Order not found', code: 'SNM0002' }))
    const s = await new SnapmintProvider(config, m.fetch).fetchStatus('o1')
    expect(s.status).toBe('pending')
  })
})

describe('webhook', () => {
  it('verifies the checksum and confirms with the order status API', async () => {
    const m = mockFetch(json(200, { status: 'success', order_status: 'SETTLED', snapmint_id: 99 }))
    const p = new SnapmintProvider(config, m.fetch)
    const parsed = p.parseWebhook({ rawBody: validBody, headers: {} })
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.eventId).toBe('o1042_1a2b3c4d_2:success')
    const event = (await p.confirmWebhookEvent(parsed.event)) as Extract<
      WebhookEvent,
      { type: 'payment.captured' }
    >
    expect(event.type).toBe('payment.captured')
    expect(event.amountPaise).toBe(1234550)
    expect(event.providerPaymentId).toBe('99')
  })

  it('does not trust a success the status API does not back', async () => {
    const m = mockFetch(json(200, { status: 'success', order_status: 'CANCELLED' }))
    const p = new SnapmintProvider(config, m.fetch)
    const parsed = p.parseWebhook({ rawBody: validBody, headers: {} })
    if (!parsed.ok) throw new Error('expected ok')
    expect((await p.confirmWebhookEvent(parsed.event)).type).toBe('payment.failed')
  })

  it('throws while the order is still pending, so Snapmint retries', async () => {
    const m = mockFetch(json(200, { status: 'success', order_status: 'PENDING_STATUS' }))
    const p = new SnapmintProvider(config, m.fetch)
    const parsed = p.parseWebhook({ rawBody: validBody, headers: {} })
    if (!parsed.ok) throw new Error('expected ok')
    await expect(p.confirmWebhookEvent(parsed.event)).rejects.toThrow(/not confirmed/)
  })

  it('refuses bad json and a bad checksum', () => {
    const p = new SnapmintProvider(config, vi.fn() as unknown as typeof fetch)
    expect(p.parseWebhook({ rawBody: 'nope', headers: {} }).ok).toBe(false)
    const forged = JSON.stringify({ ...post(), checksum_hash: 'f'.repeat(128) })
    expect(p.parseWebhook({ rawBody: forged, headers: {} })).toEqual({
      ok: false,
      reason: 'bad checksum',
    })
  })
})

describe('return post', () => {
  it('names the attempt and says whether it is signed', () => {
    const p = new SnapmintProvider(config, vi.fn() as unknown as typeof fetch)
    const signed = Object.fromEntries(Object.entries(post()).map(([k, v]) => [k, String(v)]))
    expect(p.parseReturn(signed)).toEqual({ providerRef: 'o1042_1a2b3c4d_2', verified: true })
    expect(p.parseReturn({ ...signed, status: 'failure' })).toEqual({
      providerRef: 'o1042_1a2b3c4d_2',
      verified: false,
    })
    expect(p.parseReturn({})).toBeNull()
  })
})

describe('refund', () => {
  it('refunds in rupees with our refund key as merchant_refund_id', async () => {
    const m = mockFetch(
      json(200, { status: 'success', refund_id: 127, refund_status: 'initiated' }),
    )
    const r = await new SnapmintProvider(config, m.fetch).refund('2497', 50050, 'damaged', {
      providerRef: 'o1042_1a2b3c4d_2',
      refundKey: 'rf_abc123_0',
    })
    expect(m.calls[0]?.url).toBe('https://sandboxapi.snapmint.com/v1/merchants/orders/refund_order')
    expect(JSON.parse(String(m.calls[0]?.init.body))).toEqual({
      order_id: 'o1042_1a2b3c4d_2',
      refund_amount: 500.5,
      merchant_refund_id: 'rf_abc123_0',
    })
    expect(r).toEqual({ providerRefundId: '127', status: 'pending' })
  })

  it('finds the first refund when a retry is refused as a duplicate', async () => {
    const m = mockFetch(
      json(406, { status: 'Error', message: 'Duplicate merchant refund id', code: 'SNM0020' }),
      json(200, {
        status: 'Success',
        refund_array: [
          { refund_id: 130, refund_amount: 500.5, status: 'completed', merchant_refund_id: 'rf_1' },
        ],
      }),
    )
    const r = await new SnapmintProvider(config, m.fetch).refund('2497', 50050, undefined, {
      providerRef: 'o1',
      refundKey: 'rf_1',
    })
    expect(m.calls[1]?.url).toContain('refund_status?merchant_refund_id=rf_1')
    expect(r).toEqual({ providerRefundId: '130', status: 'processed' })
  })

  it('throws when Snapmint refuses the refund', async () => {
    const m = mockFetch(json(406, { status: 'Error', message: 'Cannot refund', code: 'SNM0014' }))
    await expect(
      new SnapmintProvider(config, m.fetch).refund('2497', 100, undefined, { providerRef: 'o1' }),
    ).rejects.toThrow(/SNM0014/)
  })

  it('syncs a refund status', async () => {
    const m = mockFetch(
      json(200, { refund_array: [{ refund_id: 127, status: 'completed', refund_amount: 10 }] }),
    )
    const s = await new SnapmintProvider(config, m.fetch).fetchRefundStatus({
      providerRefundId: '127',
      providerRef: 'o1',
    })
    expect(s).toBe('processed')
  })
})

describe('visibility', () => {
  const shopper = {
    amountPaise: 2500000,
    customer: { name: 'Asha Verma', email: 'asha@example.com', phone: '9876543210' },
    shipping: payInput.shipping,
  }

  it('caps the order value at 10,000 and reads visible', async () => {
    const m = mockFetch(json(200, { status: 'success', visible: false }))
    expect(await new SnapmintProvider(config, m.fetch).checkAvailability(shopper)).toBe(false)
    const body = JSON.parse(String(m.calls[0]?.init.body))
    expect(body).toMatchObject({ mobile: 9876543210, order_value: 10000, shipping_zip: 411001 })
  })

  it('fails open on an error or a timeout', async () => {
    const down = mockFetch(new Error('network down'))
    expect(await new SnapmintProvider(config, down.fetch).checkAvailability(shopper)).toBe(true)
    const refused = mockFetch(json(401, { status: 'Error', code: 'SNM0001' }))
    expect(await new SnapmintProvider(config, refused.fetch).checkAvailability(shopper)).toBe(true)
  })

  it('gives up after 1.5 s and shows Snapmint', async () => {
    vi.useFakeTimers()
    const slow = vi.fn(
      (_url: string, init?: RequestInit) =>
        new Promise<Response>((_, reject) => {
          init?.signal?.addEventListener('abort', () => reject(new Error('aborted')))
        }),
    ) as unknown as typeof fetch
    const answer = new SnapmintProvider(config, slow).checkAvailability(shopper)
    await vi.advanceTimersByTimeAsync(1_600)
    expect(await answer).toBe(true)
    vi.useRealTimers()
  })

  it('never shows Snapmint without a 10-digit Indian mobile', async () => {
    const m = mockFetch()
    const p = new SnapmintProvider(config, m.fetch)
    expect(
      await p.checkAvailability({ ...shopper, customer: { ...shopper.customer, phone: '123' } }),
    ).toBe(false)
    expect(m.calls).toHaveLength(0)
  })
})

describe('factory', () => {
  it('needs all three keys and defaults to the sandbox', () => {
    expect(snapmintFactory.validateConfig({}).ok).toBe(false)
    const r = snapmintFactory.validateConfig({
      merchantId: ' 12345 ',
      merchantKey: 'k',
      merchantToken: 't',
    })
    expect(r).toEqual({
      ok: true,
      config: { merchantId: '12345', merchantKey: 'k', merchantToken: 't', mode: 'test' },
    })
    const secret = snapmintFactory.fields.filter((f) => f.secret).map((f) => f.key)
    expect(secret).toEqual(['merchantKey', 'merchantToken'])
  })
})
