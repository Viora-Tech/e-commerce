import { createHmac } from 'node:crypto'
import { describePaymentProvider } from '@commerce/payments/testing'
import { describe, expect, it } from 'vitest'
import { RazorpayProvider, razorpayFactory } from '../src/razorpay'

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
})
