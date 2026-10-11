import { describePaymentProvider } from '@commerce/payments/testing'
import { describe, expect, it, vi } from 'vitest'
import {
  attemptFromReference,
  DECENTRO_CALLBACK_ACK,
  type DecentroConfig,
  DecentroProvider,
  decentroFactory,
  decentroReferenceId,
  decentroStatus,
} from '../src/decentro'
import { payoutReferenceId, payoutStatusOf } from '../src/payouts'

const config: DecentroConfig = {
  clientId: 'dc_client',
  clientSecret: 'dc_secret',
  consumerUrn: 'URN123',
  mode: 'test',
  webhookSecret: 'hooksecret123',
}

const ORDER_ID = '01a0bcde-1234-5678-9abc-def012345678'

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

/** A fetch double that answers from a queue and records every call. */
function fakeFetch(...replies: Response[]) {
  const calls: { url: string; init: RequestInit }[] = []
  const fn = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} })
    const next = replies.shift()
    if (!next) throw new Error(`unexpected call to ${String(url)}`)
    return next
  })
  return { fetch: fn as unknown as typeof fetch, calls }
}

const bodyOf = (init: RequestInit) => JSON.parse(String(init.body)) as Record<string, unknown>

const successCallback = {
  amount: 26.99,
  attempt_decentro_txn_id: 'ATT1',
  bank_reference_number: '1234',
  callback_attempt: 1,
  callback_timestamp: '2026-09-26T10:00:00.000000',
  callback_txn_id: 'CB2',
  collection_type: 'dynamic_qr',
  consumer_urn: 'URN123',
  decentro_txn_id: 'DTX1',
  original_callback_txn_id: 'CB1',
  paid_amount: 26.99,
  payer_vpa: 'shopper@bank',
  purpose_message: 'Order 7',
  reference_id: `${ORDER_ID}-1`,
  transaction_attempt_status: 'SUCCESS',
  transaction_status: 'SUCCESS',
  transaction_status_description: 'Payment Request is successful',
}

const signed = (body: unknown) => ({
  rawBody: JSON.stringify(body),
  headers: { 'x-webhook-token': config.webhookSecret as string },
})

describePaymentProvider('decentro', {
  create: () => new DecentroProvider(config, vi.fn() as unknown as typeof fetch),
  amountPaise: 1000,
  live: false,
  webhooks: {
    valid: signed(successCallback),
    // Decentro doesn't sign bodies; a body for another merchant's account must still fail.
    tampered: signed({ ...successCallback, consumer_urn: 'SOMEONE_ELSE' }),
  },
})

describe('reference ids', () => {
  it('turns the attempt key into a Decentro-safe reference and back', () => {
    const ref = decentroReferenceId({
      orderId: ORDER_ID,
      amountPaise: 1000,
      currency: 'INR',
      customer: {},
      idempotencyKey: `${ORDER_ID}:2`,
    })
    expect(ref).toBe(`${ORDER_ID}-2`)
    expect(attemptFromReference(ref)).toEqual({
      idempotencyKey: `${ORDER_ID}:2`,
      orderId: ORDER_ID,
    })
    expect(attemptFromReference(undefined)).toEqual({ idempotencyKey: null, orderId: null })
  })

  it('keeps payout references alphanumeric', () => {
    expect(payoutReferenceId(`${ORDER_ID}:refund:1`)).toMatch(/^[A-Za-z0-9]+$/)
  })
})

describe('status mapping', () => {
  it.each([
    ['SUCCESS', 'captured'],
    ['FAILED', 'failed'],
    ['EXPIRED', 'failed'],
    ['REQUEST_UNINITIALIZED', 'failed'],
    ['PENDING', 'pending'],
    ['DEEMED', 'pending'],
    ['DISPUTED_AMOUNT', 'pending'],
    [undefined, 'pending'],
  ])('%s -> %s', (input, expected) => {
    expect(decentroStatus(input)).toBe(expected)
  })

  it('maps payout statuses in any case', () => {
    expect(payoutStatusOf('success')).toBe('processed')
    expect(payoutStatusOf('FAILURE')).toBe('failed')
    expect(payoutStatusOf('unknown')).toBe('pending')
  })
})

describe('createPayment', () => {
  const input = {
    orderId: ORDER_ID,
    orderNumber: 7,
    amountPaise: 2699,
    currency: 'INR' as const,
    customer: {},
    idempotencyKey: `${ORDER_ID}:1`,
    returnUrl: 'https://shop.example/thanks',
  }

  it('creates a UPI payment link with auth headers and returns a upi_qr session', async () => {
    const { fetch, calls } = fakeFetch(
      jsonResponse(200, {
        decentro_txn_id: 'DTX1',
        api_status: 'SUCCESS',
        data: {
          upi_uris: {
            common_uri: 'upi://pay?pa=x@y&am=26.99',
            gpay_uri: 'tez://upi/pay?pa=x@y',
            phonepe_uri: 'phonepe://pay?pa=x@y',
          },
          transaction_status: 'PENDING',
        },
        response_key: 'success_payment_link_created',
      }),
    )
    const now = new Date('2026-09-26T10:00:00Z')
    const p = new DecentroProvider(config, fetch, () => now)
    const r = await p.createPayment(input)

    expect(calls[0]?.url).toBe('https://staging.api.decentro.tech/v3/payments/upi/link')
    const headers = calls[0]?.init.headers as Record<string, string>
    expect(headers.client_id).toBe('dc_client')
    expect(headers.client_secret).toBe('dc_secret')
    expect(bodyOf(calls[0]?.init ?? {})).toMatchObject({
      reference_id: `${ORDER_ID}-1`,
      consumer_urn: 'URN123',
      amount: 26.99,
      purpose_message: 'Order 7',
      expiry_time: 30,
      redirect_url: 'https://shop.example/thanks',
      generate_psp_uri: true,
    })
    expect(r).toEqual({
      providerRef: 'DTX1',
      status: 'pending',
      session: {
        kind: 'upi_qr',
        provider: 'decentro',
        providerRef: 'DTX1',
        qr: {
          upiUri: 'upi://pay?pa=x@y&am=26.99',
          apps: [
            { id: 'gpay', uri: 'tez://upi/pay?pa=x@y' },
            { id: 'phonepe', uri: 'phonepe://pay?pa=x@y' },
          ],
          amountPaise: 2699,
          expiresAt: '2026-09-26T10:30:00.000Z',
        },
      },
    })
  })

  it('uses the live host in live mode', async () => {
    const { fetch, calls } = fakeFetch(
      jsonResponse(200, {
        decentro_txn_id: 'DTX2',
        api_status: 'SUCCESS',
        data: { upi_uris: { common_uri: 'upi://pay?pa=x@y' }, transaction_status: 'PENDING' },
      }),
    )
    const p = new DecentroProvider({ ...config, mode: 'live' }, fetch)
    const r = await p.createPayment(input)
    expect(calls[0]?.url).toBe('https://api.decentro.tech/v3/payments/upi/link')
    expect(r.session).toMatchObject({
      kind: 'upi_qr',
      qr: { upiUri: 'upi://pay?pa=x@y', apps: [] },
    })
  })

  it('errors when Decentro returns no UPI link', async () => {
    const { fetch } = fakeFetch(
      jsonResponse(200, { decentro_txn_id: 'DTX3', api_status: 'SUCCESS', data: {} }),
    )
    const p = new DecentroProvider(config, fetch)
    await expect(p.createPayment(input)).rejects.toThrow('did not return a UPI link')
  })

  it('refuses amounts under ₹5 without calling Decentro', async () => {
    const { fetch, calls } = fakeFetch()
    const p = new DecentroProvider(config, fetch)
    await expect(p.createPayment({ ...input, amountPaise: 499 })).rejects.toThrow('₹5')
    expect(calls).toHaveLength(0)
  })

  it('surfaces a FAILURE reply as an error', async () => {
    const { fetch } = fakeFetch(
      jsonResponse(400, {
        api_status: 'FAILURE',
        message: 'Consumer URN passed is not valid.',
        response_key: 'error_invalid_consumer_urn',
      }),
    )
    const p = new DecentroProvider(config, fetch)
    await expect(p.createPayment(input)).rejects.toThrow('Consumer URN passed is not valid.')
  })
})

describe('fetchStatus', () => {
  const statusReply = (status: string, attempts: unknown[] = []) =>
    jsonResponse(200, {
      decentro_txn_id: 'LOOKUP',
      api_status: 'SUCCESS',
      data: {
        transaction_description: {
          transaction_status: status,
          transaction_amount: 26.99,
          request_decentro_txn_id: 'DTX1',
        },
        transaction_attempt_description: attempts,
      },
    })

  it('reports a paid request as captured with the request id as payment id', async () => {
    const { fetch, calls } = fakeFetch(
      statusReply('SUCCESS', [{ transaction_attempt_status: 'SUCCESS', amount: 26.99 }]),
    )
    const s = await new DecentroProvider(config, fetch).fetchStatus('DTX1')
    expect(calls[0]?.url).toBe(
      'https://staging.api.decentro.tech/v3/payments/transaction/advance/status?decentro_txn_id=DTX1',
    )
    expect(s).toEqual({ status: 'captured', providerPaymentId: 'DTX1', amountPaise: 2699 })
  })

  it.each(['FAILED', 'EXPIRED'])('treats %s as terminal failure', async (status) => {
    const { fetch } = fakeFetch(statusReply(status))
    const s = await new DecentroProvider(config, fetch).fetchStatus('DTX1')
    expect(s).toEqual({ status: 'failed', providerPaymentId: null, amountPaise: 2699 })
  })

  it('keeps DEEMED pending', async () => {
    const { fetch } = fakeFetch(statusReply('DEEMED'))
    expect((await new DecentroProvider(config, fetch).fetchStatus('DTX1')).status).toBe('pending')
  })
})

describe('parseWebhook', () => {
  const p = new DecentroProvider(config, vi.fn() as unknown as typeof fetch)

  it('normalises a success callback and dedupes on the first callback id', () => {
    const r = p.parseWebhook(signed(successCallback))
    expect(r).toEqual({
      ok: true,
      eventId: 'CB1',
      event: {
        type: 'payment.captured',
        providerRef: 'DTX1',
        idempotencyKey: `${ORDER_ID}:1`,
        providerPaymentId: 'DTX1',
        amountPaise: 2699,
        orderId: ORDER_ID,
        // No fee on Decentro callbacks; the method is always UPI.
        charges: { feePaise: null, feeTaxPaise: null, method: { kind: 'upi' } },
        raw: successCallback,
      },
    })
    expect(p.webhookAck).toEqual(DECENTRO_CALLBACK_ACK)
  })

  it('accepts the secret as a bearer token too', () => {
    const r = p.parseWebhook({
      rawBody: JSON.stringify(successCallback),
      headers: { authorization: 'Bearer hooksecret123' },
    })
    expect(r.ok).toBe(true)
  })

  it('rejects a wrong token, a missing token and a secret-less setup', () => {
    const body = JSON.stringify(successCallback)
    expect(p.parseWebhook({ rawBody: body, headers: { 'x-webhook-token': 'nope' } })).toEqual({
      ok: false,
      reason: 'bad token',
    })
    expect(p.parseWebhook({ rawBody: body, headers: {} })).toEqual({
      ok: false,
      reason: 'missing token',
    })
    const noSecret = new DecentroProvider(
      { ...config, webhookSecret: undefined },
      vi.fn() as unknown as typeof fetch,
    )
    expect(noSecret.parseWebhook(signed(successCallback)).ok).toBe(false)
  })

  it('rejects bad JSON and bodies that are not transaction callbacks', () => {
    expect(p.parseWebhook({ rawBody: 'not json', headers: signed({}).headers }).ok).toBe(false)
    expect(p.parseWebhook(signed({ consumer_urn: 'URN123' })).ok).toBe(false)
  })

  it('maps FAILED and EXPIRED to payment.failed with the reason', () => {
    const failed = p.parseWebhook(
      signed({
        ...successCallback,
        transaction_status: 'FAILED',
        transaction_attempt_status: 'FAILED',
        error_key_description: 'Z9 - INSUFFICIENT FUNDS',
      }),
    )
    expect(failed.ok && failed.event).toMatchObject({
      type: 'payment.failed',
      providerRef: 'DTX1',
      reason: 'Z9 - INSUFFICIENT FUNDS',
    })
    const expired = p.parseWebhook(
      signed({ ...successCallback, transaction_status: 'EXPIRED', transaction_attempt_status: '' }),
    )
    expect(expired.ok && expired.event.type).toBe('payment.failed')
  })

  it('ignores held, released, auto-refunded, deemed and disputed callbacks', () => {
    for (const extra of [
      { transaction_attempt_status: 'HOLD' },
      { attempt_action: 'RELEASED' },
      { attempt_action: 'AUTO_REFUND' },
      { transaction_status: 'DEEMED', transaction_attempt_status: 'DEEMED' },
      { transaction_status: 'DISPUTED_AMOUNT' },
    ]) {
      const r = p.parseWebhook(signed({ ...successCallback, ...extra }))
      expect(r.ok && r.event.type).toBe('ignored')
    }
  })
})

describe('refund', () => {
  it('refunds to source with our refund key as the reference', async () => {
    const { fetch, calls } = fakeFetch(
      jsonResponse(200, {
        decentro_txn_id: 'RF1',
        status: 'SUCCESS',
        data: { refund_status: 'REFUND_INITIATED' },
        response_key: 'success_refund_status_initiated',
      }),
    )
    const r = await new DecentroProvider(config, fetch).refund('DTX1', 1000, 'Damaged item!', {
      refundKey: `${ORDER_ID}:r1`,
    })
    expect(calls[0]?.url).toBe('https://staging.api.decentro.tech/v3/payments/upi/refund')
    expect(bodyOf(calls[0]?.init ?? {})).toEqual({
      reference_id: `${ORDER_ID}-r1`,
      original_transaction_id: 'DTX1',
      purpose_message: 'Damaged item',
      amount: 10,
    })
    expect(r).toEqual({ providerRefundId: 'RF1', status: 'pending' })
  })

  it('reports the first refund when the same key is sent twice', async () => {
    const { fetch, calls } = fakeFetch(
      jsonResponse(400, {
        status: 'FAILURE',
        message: 'Duplicate Request Reference ID',
        response_key: 'error_duplicate_reference_id',
      }),
      jsonResponse(200, {
        api_status: 'SUCCESS',
        data: { transaction_status: 'REFUNDED', request_decentro_txn_id: 'RF1' },
      }),
    )
    const r = await new DecentroProvider(config, fetch).refund('DTX1', 1000, undefined, {
      refundKey: 'rk1',
    })
    expect(calls[1]?.url).toContain('/v3/payments/transaction/status?reference_id=rk1')
    expect(r).toEqual({ providerRefundId: 'RF1', status: 'processed' })
  })

  it('throws when Decentro says the refund failed', async () => {
    const { fetch } = fakeFetch(
      jsonResponse(200, {
        status: 'FAILURE',
        message: 'Remitter account balance is not sufficient.',
        response_key: 'error_insufficient_balance',
      }),
    )
    await expect(new DecentroProvider(config, fetch).refund('DTX1', 1000)).rejects.toThrow(
      'balance is not sufficient',
    )
  })
})

describe('refundViaPayout', () => {
  it('sends a UPI payout from the payouts host', async () => {
    const { fetch, calls } = fakeFetch(
      jsonResponse(201, {
        decentro_txn_id: 'PO1',
        api_status: 'SUCCESS',
        data: { transfer_type: 'upi', transaction_status: 'success' },
      }),
    )
    const r = await new DecentroProvider(config, fetch).refundViaPayout({
      toUpi: 'shopper@bank',
      payeeName: "Asha O'Neil",
      amountPaise: 2699,
      refundKey: `${ORDER_ID}:r1`,
    })
    expect(calls[0]?.url).toBe(
      'https://in.staging.decentro.tech/v3/core_banking/money_transfer/initiate',
    )
    expect(bodyOf(calls[0]?.init ?? {})).toMatchObject({
      consumer_urn: 'URN123',
      transfer_type: 'UPI',
      transfer_amount: 26.99,
      beneficiary_details: { payee_name: 'Asha O Neil', to_upi: 'shopper@bank' },
    })
    expect(r).toEqual({ providerRefundId: 'PO1', status: 'processed' })
  })

  it('rejects a malformed UPI ID before calling Decentro', async () => {
    const { fetch, calls } = fakeFetch()
    await expect(
      new DecentroProvider(config, fetch).refundViaPayout({
        toUpi: 'not-a-upi-id',
        payeeName: 'A',
        amountPaise: 1000,
        refundKey: 'k',
      }),
    ).rejects.toThrow('UPI ID')
    expect(calls).toHaveLength(0)
  })
})

describe('testConnection', () => {
  it('passes when Decentro finds no such transaction', async () => {
    const { fetch, calls } = fakeFetch(
      jsonResponse(404, {
        api_status: 'FAILURE',
        response_key: 'error_no_transaction_found',
        message: 'This transaction was not found in our system.',
      }),
    )
    const r = await new DecentroProvider(config, fetch).testConnection()
    expect(r.ok).toBe(true)
    expect(calls[0]?.init.method).toBe('GET')
    expect(calls[0]?.url).toMatch(
      /\/v3\/payments\/transaction\/status\?reference_id=conntest[0-9a-f]{12}$/,
    )
  })

  it('passes when Decentro answers "Invalid Reference ID" for the made-up reference', async () => {
    const { fetch } = fakeFetch(
      jsonResponse(400, {
        api_status: 'FAILURE',
        response_key: 'error_invalid_reference_id',
        message: 'Invalid Reference ID',
      }),
    )
    const r = await new DecentroProvider(config, fetch).testConnection()
    expect(r.ok).toBe(true)
  })

  it('fails with a plain message on bad keys', async () => {
    const { fetch } = fakeFetch(
      jsonResponse(401, {
        api_status: 'FAILURE',
        response_key: 'error_invalid_client_secret',
        message: 'Authentication failed.',
      }),
    )
    const r = await new DecentroProvider(config, fetch).testConnection()
    expect(r.ok).toBe(false)
    expect(r.message).toContain("didn't accept these keys")
  })

  it('fails when Decentro cannot be reached', async () => {
    const fetch = vi.fn(async () => {
      throw new Error('ECONNREFUSED')
    }) as unknown as typeof globalThis.fetch
    const r = await new DecentroProvider(config, fetch).testConnection()
    expect(r).toEqual({ ok: false, message: 'Could not reach Decentro: ECONNREFUSED' })
  })
})

describe('decentroFactory', () => {
  it('flags the credentials as secret', () => {
    const secret = decentroFactory.fields.filter((f) => f.secret).map((f) => f.key)
    expect(secret).toEqual(['clientSecret', 'webhookSecret'])
  })

  it('validates required keys and defaults to test mode', () => {
    expect(decentroFactory.validateConfig({})).toEqual({
      ok: false,
      errors: ['clientId is required', 'clientSecret is required', 'consumerUrn is required'],
    })
    const r = decentroFactory.validateConfig({
      clientId: ' a ',
      clientSecret: 'b',
      consumerUrn: 'c',
      webhookSecret: '',
    })
    expect(r).toEqual({
      ok: true,
      config: {
        clientId: 'a',
        clientSecret: 'b',
        consumerUrn: 'c',
        mode: 'test',
        webhookSecret: undefined,
        payoutConsumerUrn: undefined,
      },
    })
  })
})
