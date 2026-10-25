import { createHmac } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { chargesOf, type RzpPayment, type RzpPaymentCharges } from '../src/charges'
import { RazorpayProvider } from '../src/razorpay'

const config = {
  keyId: 'rzp_test_offline',
  keySecret: 'offline-secret',
  webhookSecret: 'whsec_test',
}
/** The method part of `chargesOf`, for payments in any shape. */
const methodOf = (p: RzpPaymentCharges) => chargesOf({ ...p, amount: 1 }).method

const sign = (body: string) => createHmac('sha256', config.webhookSecret).update(body).digest('hex')

/** Shaped like Razorpay's documented payment entity (fee and tax in paise, GST inside fee). */
const cardPayment: RzpPayment = {
  id: 'pay_card',
  order_id: 'order_abc',
  amount: 100_000,
  status: 'captured',
  method: 'card',
  international: false,
  fee: 2_360,
  tax: 360,
  card: { type: 'debit', network: 'RuPay', international: false, sub_type: 'customer' },
  notes: { orderId: '01a0-order' },
}

describe('methodOf', () => {
  it('reads the card type, network, sub-type and international flag', () => {
    expect(methodOf(cardPayment)).toEqual({
      kind: 'card',
      cardType: 'debit',
      network: 'rupay',
      international: false,
      corporate: false,
      provider: undefined,
    })
    expect(
      methodOf({
        ...cardPayment,
        card: { type: 'credit', network: 'American Express', sub_type: 'business' },
      }),
    ).toMatchObject({ cardType: 'credit', network: 'amex', corporate: true })
    expect(
      methodOf({ ...cardPayment, card: { type: 'unknown', network: 'Unknown' } }),
    ).toMatchObject({ cardType: undefined, network: undefined })
  })

  it('reads UPI, netbanking, wallets, EMI and pay later', () => {
    const plain = { id: 'p', amount: 1, status: 'captured' }
    expect(methodOf({ ...plain, method: 'upi' })?.kind).toBe('upi')
    expect(methodOf({ ...plain, method: 'netbanking', bank: 'HDFC' })).toMatchObject({
      kind: 'netbanking',
      provider: 'HDFC',
    })
    expect(methodOf({ ...plain, method: 'wallet', wallet: 'payzapp' })).toMatchObject({
      kind: 'wallet',
      provider: 'payzapp',
    })
    expect(methodOf({ ...plain, method: 'emi' })?.kind).toBe('emi')
    expect(methodOf({ ...plain, method: 'cardless_emi' })?.kind).toBe('cardless_emi')
    expect(methodOf({ ...plain, method: 'paylater' })?.kind).toBe('paylater')
    expect(methodOf({ ...plain, method: 'something_new' })?.kind).toBe('other')
    expect(methodOf({ ...plain, method: null })).toBeNull()
  })

  it('takes international from the payment when the card does not say', () => {
    expect(
      methodOf({ ...cardPayment, international: true, card: { type: 'credit' } }),
    ).toMatchObject({ international: true })
  })
})

describe('chargesOf', () => {
  it('keeps the fee with GST inside, and the GST, in paise', () => {
    expect(chargesOf(cardPayment)).toMatchObject({
      feePaise: 2_360,
      feeTaxPaise: 360,
      grossPaise: 100_000,
    })
  })

  it('a fee not worked out yet is unknown, not zero', () => {
    expect(chargesOf({ ...cardPayment, fee: null, tax: null })).toMatchObject({
      feePaise: null,
      feeTaxPaise: null,
    })
    const { fee: _fee, ...noFee } = cardPayment
    expect(chargesOf(noFee)).toMatchObject({ feePaise: null })
  })

  it('a zero fee (zero-MDR plan) is a real fee', () => {
    expect(chargesOf({ ...cardPayment, fee: 0, tax: 0 })).toMatchObject({
      feePaise: 0,
      feeTaxPaise: 0,
    })
  })
})

describe('fees on webhooks', () => {
  const p = new RazorpayProvider(config)
  const parse = (body: string) =>
    p.parseWebhook({ rawBody: body, headers: { 'x-razorpay-signature': sign(body) } })

  it('a capture carries the fee and the method', () => {
    const body = JSON.stringify({
      event: 'payment.captured',
      payload: { payment: { entity: cardPayment } },
    })
    const r = parse(body)
    expect(r.ok && r.event).toMatchObject({
      type: 'payment.captured',
      charges: {
        feePaise: 2_360,
        feeTaxPaise: 360,
        method: { kind: 'card', cardType: 'debit', network: 'rupay' },
      },
    })
  })

  it('a paid UPI QR carries its payment’s fee', () => {
    const body = JSON.stringify({
      event: 'qr_code.credited',
      payload: {
        payment: { entity: { ...cardPayment, method: 'upi', card: null, fee: 0, tax: 0 } },
        qr_code: { entity: { id: 'qr_1', status: 'closed', image_url: 'x', notes: {} } },
      },
    })
    const r = parse(body)
    expect(r.ok && r.event).toMatchObject({
      type: 'payment.captured',
      providerRef: 'qr_1',
      charges: { feePaise: 0, method: { kind: 'upi' } },
    })
  })
})

describe('fetchCharges', () => {
  it('fetches the payment with its card entity, never creating anything', async () => {
    const p = new RazorpayProvider(config)
    const fetchPayment = vi.fn(async () => cardPayment)
    // Mock the HTTP client: nothing leaves the machine.
    const client = (p as unknown as { client: { payments: { fetch: typeof fetchPayment } } }).client
    client.payments.fetch = fetchPayment
    const r = await p.fetchCharges({ providerRef: 'order_abc', providerPaymentId: 'pay_card' })
    expect(fetchPayment).toHaveBeenCalledWith('pay_card', { 'expand[]': 'card' })
    expect(r).toMatchObject({ feePaise: 2_360, feeTaxPaise: 360 })
  })

  it('answers nothing for a payment that did not take money', async () => {
    const p = new RazorpayProvider(config)
    const client = (p as unknown as { client: { payments: { fetch: () => Promise<unknown> } } })
      .client
    client.payments.fetch = vi.fn(async () => ({ ...cardPayment, status: 'failed' }))
    expect(await p.fetchCharges({ providerRef: 'o', providerPaymentId: 'p' })).toBeNull()
  })
})
