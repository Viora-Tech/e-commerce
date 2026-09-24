import { createHmac } from 'node:crypto'
import { PaymentRegistry } from '@commerce/payments'
import { describe, expect, it, vi } from 'vitest'
import { razorpayFactory } from '../src/razorpay'
import {
  buildQrNotes,
  QR_OPEN_MINUTES,
  qrCloseBy,
  RazorpayUpiQrProvider,
  razorpayUpiFactory,
  upiIntentOf,
} from '../src/upi-qr'

const config = {
  keyId: 'rzp_test_offline',
  keySecret: 'offline-secret',
  webhookSecret: 'whsec_test',
}
const NOW = new Date('2026-09-24T12:00:00Z')
const sign = (body: string) => createHmac('sha256', config.webhookSecret).update(body).digest('hex')

type QrApi = {
  create: ReturnType<typeof vi.fn>
  fetch: ReturnType<typeof vi.fn>
  fetchAllPayments: ReturnType<typeof vi.fn>
}

/** The provider with Razorpay's HTTP client replaced: nothing leaves the machine. */
function offline(overrides: Partial<QrApi> = {}) {
  const p = new RazorpayUpiQrProvider(config, () => NOW)
  const qrCode: QrApi = {
    create: vi.fn(async (body: Record<string, unknown>) => ({
      id: 'qr_1',
      status: 'active',
      image_url: 'https://rzp.io/i/qr_1',
      ...body,
    })),
    fetch: vi.fn(),
    fetchAllPayments: vi.fn(),
    ...overrides,
  }
  ;(p as unknown as { client: { qrCode: QrApi } }).client.qrCode = qrCode
  return { p, qrCode }
}

const input = {
  orderId: 'o1',
  orderNumber: 1042,
  amountPaise: 269_900,
  currency: 'INR' as const,
  customer: {},
  idempotencyKey: 'o1:2',
}

describe('razorpay UPI QR: creating', () => {
  it('creates a single-use QR for the exact amount, closing in 30 minutes, keyed by the attempt', async () => {
    const { p, qrCode } = offline()
    const r = await p.createPayment(input)
    expect(qrCode.create).toHaveBeenCalledTimes(1)
    expect(qrCode.create.mock.calls[0]?.[0]).toMatchObject({
      type: 'upi_qr',
      usage: 'single_use',
      fixed_amount: true,
      payment_amount: 269_900,
      description: 'Order 1042',
      close_by: Math.floor(NOW.getTime() / 1000) + QR_OPEN_MINUTES * 60,
      notes: { orderId: 'o1', orderNumber: '1042', idempotencyKey: 'o1:2' },
    })
    expect(r).toMatchObject({
      providerRef: 'qr_1',
      status: 'pending',
      session: {
        kind: 'upi_qr',
        provider: 'razorpay_upi',
        providerRef: 'qr_1',
        qr: {
          imageUrl: 'https://rzp.io/i/qr_1',
          amountPaise: 269_900,
          expiresAt: '2026-09-24T12:30:00.000Z',
        },
      },
    })
    expect(r.session.kind === 'upi_qr' && r.session.qr.upiUri).toBeUndefined()
  })

  it('passes a upi:// intent through only when the gateway returns one', () => {
    expect(upiIntentOf({ payload: 'upi://pay?pa=x@rzp&am=10.00' })).toBe(
      'upi://pay?pa=x@rzp&am=10.00',
    )
    expect(upiIntentOf({ payload: 'https://example.com' })).toBeUndefined()
    expect(upiIntentOf({})).toBeUndefined()
  })

  it('keeps notes to what matching needs', () => {
    expect(buildQrNotes({ ...input, orderNumber: undefined, idempotencyKey: undefined })).toEqual({
      orderId: 'o1',
    })
    expect(qrCloseBy(NOW, 1)).toBe(Math.floor(NOW.getTime() / 1000) + 60)
  })
})

describe('razorpay UPI QR: webhooks', () => {
  const { p } = offline()
  const parse = (body: unknown, eventId: string) => {
    const raw = JSON.stringify(body)
    return p.parseWebhook({
      rawBody: raw,
      headers: { 'x-razorpay-signature': sign(raw), 'x-razorpay-event-id': eventId },
    })
  }
  const qrEntity = {
    id: 'qr_1',
    status: 'closed',
    image_url: 'https://rzp.io/i/qr_1',
    payment_amount: 269_900,
    payments_amount_received: 0,
    notes: { orderId: 'o1', idempotencyKey: 'o1:2' },
  }

  it('turns qr_code.credited into a capture on the QR reference', () => {
    const r = parse(
      {
        event: 'qr_code.credited',
        payload: {
          payment: {
            entity: { id: 'pay_9', amount: 269_900, status: 'captured', order_id: null, notes: [] },
          },
          qr_code: { entity: { ...qrEntity, payments_amount_received: 269_900 } },
        },
      },
      'evt_c',
    )
    expect(r.ok && r.event).toMatchObject({
      type: 'payment.captured',
      providerRef: 'qr_1',
      providerPaymentId: 'pay_9',
      idempotencyKey: 'o1:2',
      amountPaise: 269_900,
      orderId: 'o1',
    })
  })

  it('fails the attempt when the QR closes unpaid, and ignores the close after a payment', () => {
    const unpaid = parse(
      {
        event: 'qr_code.closed',
        payload: { qr_code: { entity: { ...qrEntity, close_reason: null } } },
      },
      'evt_x',
    )
    expect(unpaid.ok && unpaid.event).toMatchObject({
      type: 'payment.failed',
      providerRef: 'qr_1',
      idempotencyKey: 'o1:2',
      reason: 'UPI QR closed unpaid (expired)',
    })
    const paid = parse(
      {
        event: 'qr_code.closed',
        payload: { qr_code: { entity: { ...qrEntity, close_reason: 'paid' } } },
      },
      'evt_y',
    )
    expect(paid.ok && paid.event.type).toBe('ignored')
  })

  it('rejects a QR webhook with a bad signature', () => {
    const raw = JSON.stringify({ event: 'qr_code.credited' })
    expect(p.parseWebhook({ rawBody: raw, headers: { 'x-razorpay-signature': 'nope' } }).ok).toBe(
      false,
    )
  })
})

describe('razorpay UPI QR: status', () => {
  it('reads pending, failed and captured from the QR', async () => {
    const fetch = vi.fn()
    const fetchAllPayments = vi.fn(async () => ({
      items: [{ id: 'pay_9', status: 'captured', amount: 100 }],
    }))
    const { p } = offline({ fetch, fetchAllPayments })
    fetch.mockResolvedValueOnce({ id: 'qr_1', status: 'active', payment_amount: 100 })
    expect(await p.fetchStatus('qr_1')).toEqual({
      status: 'pending',
      providerPaymentId: null,
      amountPaise: 100,
    })
    fetch.mockResolvedValueOnce({ id: 'qr_1', status: 'closed', payment_amount: 100 })
    expect((await p.fetchStatus('qr_1')).status).toBe('failed')
    fetch.mockResolvedValueOnce({
      id: 'qr_1',
      status: 'closed',
      close_reason: 'paid',
      payment_amount: 100,
      payments_amount_received: 100,
    })
    expect(await p.confirm('qr_1', {})).toEqual({ status: 'captured', providerPaymentId: 'pay_9' })
    expect(fetchAllPayments).toHaveBeenCalledTimes(1)
  })
})

describe('razorpay UPI QR: settings', () => {
  it('runs on the Razorpay keys and shares the Razorpay webhook', () => {
    const registry = new PaymentRegistry().register(razorpayFactory).register(razorpayUpiFactory)
    const saved = { razorpay: { ...config } }
    const raw = registry.configFor('razorpay_upi', saved)
    expect(raw).toEqual(config)
    const r = registry.create('razorpay_upi', raw)
    expect(r.ok && r.provider.id).toBe('razorpay_upi')
    expect(r.ok && r.provider.webhookId).toBe('razorpay')
    expect(registry.create('razorpay_upi', registry.configFor('razorpay_upi', {})).ok).toBe(false)
  })
})
