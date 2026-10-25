import { createHmac } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { CashfreeProvider } from '../src/cashfree'
import {
  type CfOrderSettlement,
  type CfPaymentMethod,
  chargesFromDetails,
  chargesOfPayment,
  methodOnly,
} from '../src/charges'

/** The method a payment in this group, paid this way, records. */
const cashfreeMethodOf = (group: string | undefined, method: CfPaymentMethod | null) =>
  methodOnly({
    payment_amount: 1,
    ...(group ? { payment_group: group } : {}),
    payment_method: method,
  }).method

/** The fee a settlement gives a payment. */
const chargesFromSettlement = (s: CfOrderSettlement | null) => {
  const r = chargesOfPayment({ payment_status: 'SUCCESS', payment_amount: 0 }, s, '42')
  return { feePaise: r.feePaise, feeTaxPaise: r.feeTaxPaise }
}

const config = { appId: 'cf_test_app', secretKey: 'cf_test_secret', mode: 'test' as const }

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

const ts = String(Date.now())
const sign = (body: string) =>
  createHmac('sha256', config.secretKey).update(`${ts}${body}`).digest('base64')
const parse = (body: unknown) => {
  const rawBody = JSON.stringify(body)
  return new CashfreeProvider(config).parseWebhook({
    rawBody,
    headers: { 'x-webhook-signature': sign(rawBody), 'x-webhook-timestamp': ts },
  })
}

/** Shaped like Cashfree's documented card `payment_method`. */
const visaCredit = {
  card: {
    channel: 'link',
    card_number: 'XXXXXXXXXXXX1111',
    card_network: 'visa',
    card_type: 'credit_card',
    card_sub_type: 'R',
    card_country: 'IN',
    card_bank_name: 'HDFC Bank',
  },
}

describe('cashfreeMethodOf', () => {
  it('reads the group, network, sub-type and issuing country', () => {
    expect(cashfreeMethodOf('credit_card', visaCredit)).toEqual({
      kind: 'card',
      cardType: 'credit',
      network: 'visa',
      corporate: false,
      international: false,
      provider: undefined,
    })
    expect(
      cashfreeMethodOf('debit_card', {
        card: { card_network: 'rupay', card_sub_type: 'C', card_country: 'IN' },
      }),
    ).toMatchObject({ kind: 'card', cardType: 'debit', network: 'rupay', corporate: true })
    expect(
      cashfreeMethodOf('credit_card', { card: { card_network: 'amex', card_country: 'US' } }),
    ).toMatchObject({ network: 'amex', international: true })
  })

  it('maps UPI, netbanking, wallets, EMI and pay later', () => {
    expect(cashfreeMethodOf('upi', { upi: { channel: 'collect' } })?.kind).toBe('upi')
    expect(cashfreeMethodOf('upi_credit_card', null)?.kind).toBe('upi')
    expect(
      cashfreeMethodOf('net_banking', { netbanking: { netbanking_bank_name: 'HDFC Bank' } }),
    ).toMatchObject({ kind: 'netbanking', provider: 'HDFC Bank' })
    expect(cashfreeMethodOf('wallet', { app: { provider: 'paytm' } })).toMatchObject({
      kind: 'wallet',
      provider: 'paytm',
    })
    expect(cashfreeMethodOf('credit_card_emi', null)).toMatchObject({
      kind: 'emi',
      cardType: 'credit',
    })
    expect(cashfreeMethodOf('cardless_emi', null)?.kind).toBe('cardless_emi')
    expect(cashfreeMethodOf('pay_later', { paylater: { provider: 'lazypay' } })).toMatchObject({
      kind: 'paylater',
      provider: 'lazypay',
    })
    expect(cashfreeMethodOf('paypal', null)?.kind).toBe('other')
    expect(cashfreeMethodOf(undefined, null)).toBeNull()
  })
})

describe('Cashfree charges', () => {
  it('the charges webhook fee is the service charge plus its tax', () => {
    // Cashfree's sample: ₹0.12 + ₹0.02, leaving ₹5.86 of ₹6.
    expect(
      chargesFromDetails({ service_charge: 0.12, service_tax: 0.02, settlement_amount: 5.86 }),
    ).toEqual({ feePaise: 14, feeTaxPaise: 2 })
    expect(chargesFromDetails({})).toEqual({ feePaise: null, feeTaxPaise: null })
    expect(chargesFromDetails(null)).toEqual({ feePaise: null, feeTaxPaise: null })
  })

  it('a settlement adds the gateway and forex charges, each with GST', () => {
    expect(
      chargesFromSettlement({
        payment_details: {
          pg_service_charge: 10,
          pg_service_tax: 1.8,
          forex_conversion_handling_charge: 1,
          forex_conversion_handling_tax: 0.18,
          charged_to: 'MERCHANT',
        },
      }),
    ).toEqual({ feePaise: 1_298, feeTaxPaise: 198 })
  })

  it('a charge the shopper bore is not the merchant’s', () => {
    expect(
      chargesFromSettlement({
        payment_details: { pg_service_charge: 10, pg_service_tax: 1.8, charged_to: 'CUSTOMER' },
      }),
    ).toEqual({ feePaise: 0, feeTaxPaise: 0 })
  })

  it('no settlement yet is an unknown fee', () => {
    expect(chargesFromSettlement({})).toEqual({ feePaise: null, feeTaxPaise: null })
    expect(chargesFromSettlement(null)).toEqual({ feePaise: null, feeTaxPaise: null })
  })
})

describe('fees on Cashfree webhooks', () => {
  const order = { order_id: 'o7_1a2b3c4d_1', order_amount: 6, order_currency: 'INR' }

  it('a success webhook carries the method; the fee comes later', () => {
    const r = parse({
      type: 'PAYMENT_SUCCESS_WEBHOOK',
      data: {
        order,
        payment: {
          cf_payment_id: 42,
          payment_status: 'SUCCESS',
          payment_amount: 6,
          payment_group: 'credit_card',
          payment_method: visaCredit,
        },
      },
    })
    expect(r.ok && r.event).toMatchObject({
      type: 'payment.captured',
      charges: { feePaise: null, method: { kind: 'card', cardType: 'credit', network: 'visa' } },
    })
  })

  it('the charges webhook becomes payment.charges with its own event id', () => {
    const r = parse({
      type: 'PAYMENT_CHARGES_WEBHOOK',
      data: {
        order,
        payment: { cf_payment_id: 42, payment_status: 'SUCCESS', payment_amount: 6 },
        charges_details: { service_charge: 0.12, service_tax: 0.02, settlement_amount: 5.86 },
      },
    })
    expect(r.ok && r.eventId).toBe('PAYMENT_CHARGES_WEBHOOK:42')
    expect(r.ok && r.event).toMatchObject({
      type: 'payment.charges',
      providerRef: 'o7_1a2b3c4d_1',
      providerPaymentId: '42',
      charges: { feePaise: 14, feeTaxPaise: 2, method: null },
    })
  })

  it('a charges webhook without charges is ignored', () => {
    const r = parse({
      type: 'PAYMENT_CHARGES_WEBHOOK',
      data: { order, payment: { cf_payment_id: 42, payment_status: 'SUCCESS', payment_amount: 6 } },
    })
    expect(r.ok && r.event.type).toBe('ignored')
  })
})

describe('fetchCharges', () => {
  const payment = {
    cf_payment_id: '42',
    payment_status: 'SUCCESS',
    payment_amount: 1000,
    payment_group: 'debit_card',
    payment_method: { card: { card_network: 'rupay', card_country: 'IN', card_sub_type: 'R' } },
  }

  it('reads the method from the payment and the fee from the settlement, GETs only', async () => {
    const fetchImpl = vi.fn(async (url: string) =>
      url.endsWith('/settlements')
        ? jsonResponse(200, {
            payment_details: {
              cf_payment_id: '42',
              pg_service_charge: 0,
              pg_service_tax: 0,
              charged_to: 'MERCHANT',
            },
          })
        : jsonResponse(200, payment),
    )
    const p = new CashfreeProvider(config, fetchImpl as unknown as typeof fetch)
    const r = await p.fetchCharges({ providerRef: 'o7_1a2b3c4d_1', providerPaymentId: '42' })
    expect(r).toEqual({
      feePaise: 0,
      feeTaxPaise: 0,
      method: {
        kind: 'card',
        cardType: 'debit',
        network: 'rupay',
        corporate: false,
        international: false,
        provider: undefined,
      },
      grossPaise: 100_000,
    })
    const calls = fetchImpl.mock.calls as unknown as [string, RequestInit][]
    expect(calls.map(([u]) => u)).toEqual([
      'https://sandbox.cashfree.com/pg/orders/o7_1a2b3c4d_1/payments/42',
      'https://sandbox.cashfree.com/pg/orders/o7_1a2b3c4d_1/settlements',
    ])
    expect(calls.every(([, init]) => init.method === 'GET')).toBe(true)
  })

  it('no settlement yet (404) leaves the fee unknown but keeps the method', async () => {
    const fetchImpl = vi.fn(async (url: string) =>
      url.endsWith('/settlements')
        ? jsonResponse(404, { message: 'settlement not found' })
        : jsonResponse(200, payment),
    )
    const p = new CashfreeProvider(config, fetchImpl as unknown as typeof fetch)
    const r = await p.fetchCharges({ providerRef: 'o', providerPaymentId: '42' })
    expect(r).toMatchObject({ feePaise: null, method: { kind: 'card' } })
  })

  it('a settlement for another payment on the order is not this one’s fee', async () => {
    const fetchImpl = vi.fn(async (url: string) =>
      url.endsWith('/settlements')
        ? jsonResponse(200, {
            payment_details: { cf_payment_id: '99', pg_service_charge: 20, pg_service_tax: 3.6 },
          })
        : jsonResponse(200, payment),
    )
    const p = new CashfreeProvider(config, fetchImpl as unknown as typeof fetch)
    expect(
      (await p.fetchCharges({ providerRef: 'o', providerPaymentId: '42' }))?.feePaise,
    ).toBeNull()
  })

  it('answers nothing for a payment that did not succeed, and passes other errors on', async () => {
    const failed = vi.fn(async () => jsonResponse(200, { ...payment, payment_status: 'FAILED' }))
    const p = new CashfreeProvider(config, failed as unknown as typeof fetch)
    expect(await p.fetchCharges({ providerRef: 'o', providerPaymentId: '42' })).toBeNull()
    const down = vi.fn(async (url: string) =>
      url.endsWith('/settlements') ? jsonResponse(500, {}) : jsonResponse(200, payment),
    )
    const q = new CashfreeProvider(config, down as unknown as typeof fetch)
    await expect(q.fetchCharges({ providerRef: 'o', providerPaymentId: '42' })).rejects.toThrow()
  })
})
