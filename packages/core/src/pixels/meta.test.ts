/** SOURCE OF TRUTH: Meta Conversions API client tests — WHAT: the Purchase payload snapshot, matched booleans, the error classifier, token kept out of URLs and messages / WHY: the sender's retry and auth decisions and the no-token rule rest on these; a fake fetch keeps the real Graph API out of tests */
import { describe, expect, it } from 'vitest'
import { hashUserData } from './hash'
import {
  buildMetaEvent,
  classifyMetaError,
  cleanMetaMessage,
  type FetchLike,
  matchedOf,
  sendMetaEvents,
  verifyMetaToken,
  verifyPixelToken,
} from './meta'

// Never the real Graph API: every call goes through a fake fetch.

const FAKE_TOKEN = 'EAAfake-test-token-0000'

function fakeFetch(status: number, body: unknown) {
  const calls: { url: string; init: RequestInit }[] = []
  const fn: FetchLike = async (url, init) => {
    calls.push({ url, init })
    return new Response(JSON.stringify(body), { status })
  }
  return { fn, calls }
}

const purchase = () =>
  buildMetaEvent({
    name: 'Purchase',
    eventId: 'ord_0199a000-0000-7000-8000-000000000001',
    at: new Date('2026-10-24T10:00:00Z'),
    url: 'https://waimers.in/checkout/thank-you/1042',
    user: hashUserData({ email: 'asha@example.com', phone: '9876543210' }),
    ip: '203.0.113.7',
    ua: 'Mozilla/5.0',
    fbp: 'fb.1.1792800000000.1234567890',
    fbc: 'fb.1.1792800000000.IwAR2abc',
    valuePaise: 149_900,
    contents: [
      { id: 'v1', quantity: 2, itemPricePaise: 49_950 },
      { id: 'v2', quantity: 1, itemPricePaise: 50_000 },
    ],
    orderNumber: 1042,
  })

describe('buildMetaEvent', () => {
  it('maps a Purchase to the Conversions API shape', () => {
    expect(purchase()).toMatchInlineSnapshot(`
      {
        "action_source": "website",
        "custom_data": {
          "content_ids": [
            "v1",
            "v2",
          ],
          "content_type": "product",
          "contents": [
            {
              "id": "v1",
              "item_price": 499.5,
              "quantity": 2,
            },
            {
              "id": "v2",
              "item_price": 500,
              "quantity": 1,
            },
          ],
          "currency": "INR",
          "num_items": 3,
          "order_id": "1042",
          "value": 1499,
        },
        "event_id": "ord_0199a000-0000-7000-8000-000000000001",
        "event_name": "Purchase",
        "event_source_url": "https://waimers.in/checkout/thank-you/1042",
        "event_time": 1792836000,
        "user_data": {
          "client_ip_address": "203.0.113.7",
          "client_user_agent": "Mozilla/5.0",
          "country": [
            "582967534d0f909d196b97f9e6921342777aea87b46fa52df165389db1fb8ccf",
          ],
          "em": [
            "ea4e36a829983d27e865b649cd10fcb61f2f1bcd857b47ab709e7adbe941ab68",
          ],
          "fbc": "fb.1.1792800000000.IwAR2abc",
          "fbp": "fb.1.1792800000000.1234567890",
          "ph": [
            "92b5072176e723878b5e06ff3ca61898e4eb74e8c46642a0f2db800b17364ab0",
          ],
        },
      }
    `)
  })

  it('a PageView has no custom data', () => {
    const e = buildMetaEvent({
      name: 'PageView',
      eventId: 'x',
      at: new Date(0),
      user: {},
    })
    expect(e.custom_data).toBeUndefined()
    expect(e.user_data).toEqual({})
  })

  it('matched is booleans only', () => {
    const m = matchedOf(purchase())
    expect(m).toMatchObject({
      em: true,
      ph: true,
      fn: false,
      fbp: true,
      fbc: true,
      ip: true,
      ua: true,
    })
    expect(Object.values(m).every((v) => typeof v === 'boolean')).toBe(true)
  })
})

describe('classifyMetaError', () => {
  it('sorts Meta errors into retry, auth and fail', () => {
    expect(classifyMetaError(400, 190)).toBe('auth')
    expect(classifyMetaError(400, 102)).toBe('auth')
    expect(classifyMetaError(401, null)).toBe('auth')
    expect(classifyMetaError(400, 4)).toBe('retry')
    expect(classifyMetaError(400, 17)).toBe('retry')
    expect(classifyMetaError(400, 32)).toBe('retry')
    expect(classifyMetaError(400, 613)).toBe('retry')
    expect(classifyMetaError(429, null)).toBe('retry')
    expect(classifyMetaError(503, null)).toBe('retry')
    expect(classifyMetaError(0, null)).toBe('retry')
    expect(classifyMetaError(400, 100)).toBe('fail')
  })

  it('cleans the message: token removed, 500 characters at most', () => {
    expect(cleanMetaMessage(`bad ${FAKE_TOKEN} here`, FAKE_TOKEN)).toBe('bad [token] here')
    expect(cleanMetaMessage('url?access_token=abc&x=1')).toBe('url?access_token=[token]&x=1')
    expect(cleanMetaMessage('x'.repeat(900))).toHaveLength(500)
  })
})

describe('sendMetaEvents', () => {
  it('POSTs to /<pixel>/events with the token in the body, never the URL', async () => {
    const { fn, calls } = fakeFetch(200, { events_received: 1, fbtrace_id: 'TRACE' })
    const res = await sendMetaEvents({
      pixelId: '1234567890',
      token: FAKE_TOKEN,
      events: [purchase()],
      testEventCode: 'TEST123',
      fetch: fn,
    })
    expect(res).toEqual({ ok: true, status: 200, fbtraceId: 'TRACE', eventsReceived: 1 })
    expect(calls[0]?.url).toBe('https://graph.facebook.com/v26.0/1234567890/events')
    expect(calls[0]?.url).not.toContain(FAKE_TOKEN)
    const body = JSON.parse(String(calls[0]?.init.body))
    expect(body.access_token).toBe(FAKE_TOKEN)
    expect(body.test_event_code).toBe('TEST123')
    expect(body.data).toHaveLength(1)
  })

  it('returns an auth failure for an expired token, without the token in the message', async () => {
    const { fn } = fakeFetch(400, {
      error: { message: `Session expired for ${FAKE_TOKEN}`, code: 190, fbtrace_id: 'T2' },
    })
    const res = await sendMetaEvents({
      pixelId: '1234567890',
      token: FAKE_TOKEN,
      events: [],
      fetch: fn,
    })
    expect(res).toMatchObject({ ok: false, kind: 'auth', code: 190, fbtraceId: 'T2' })
    expect(JSON.stringify(res)).not.toContain(FAKE_TOKEN)
  })

  it('turns a network error into a retry', async () => {
    const fn: FetchLike = async () => {
      throw new Error('ECONNRESET')
    }
    const res = await sendMetaEvents({
      pixelId: '1234567890',
      token: FAKE_TOKEN,
      events: [],
      fetch: fn,
    })
    expect(res).toMatchObject({ ok: false, kind: 'retry', status: 0 })
  })
})

describe('verifyMetaToken', () => {
  it("returns the pixel's name and sends the token as a header", async () => {
    const { fn, calls } = fakeFetch(200, { id: '1234567890', name: 'Waimers pixel' })
    const res = await verifyMetaToken({ pixelId: '1234567890', token: FAKE_TOKEN, fetch: fn })
    expect(res).toEqual({ ok: true, name: 'Waimers pixel' })
    expect(calls[0]?.url).toBe('https://graph.facebook.com/v26.0/1234567890?fields=id,name')
    expect(new Headers(calls[0]?.init.headers).get('authorization')).toBe(`Bearer ${FAKE_TOKEN}`)
  })

  it('reports a token that cannot see the pixel', async () => {
    const { fn } = fakeFetch(400, { error: { message: 'Unsupported get request', code: 100 } })
    const res = await verifyMetaToken({ pixelId: '1234567890', token: FAKE_TOKEN, fetch: fn })
    expect(res).toMatchObject({ ok: false, kind: 'fail', code: 100 })
  })
})

describe('verifyPixelToken', () => {
  const answers = (...list: { status: number; body: unknown }[]) => {
    const calls: { url: string; init: RequestInit }[] = []
    const fn: FetchLike = async (url, init) => {
      calls.push({ url, init })
      const next = list[calls.length - 1]
      return new Response(JSON.stringify(next?.body ?? {}), { status: next?.status ?? 500 })
    }
    return { fn, calls }
  }
  const missing = { status: 400, body: { error: { message: 'Missing Permission', code: 100 } } }

  it('keeps the name when the token can read the pixel', async () => {
    const { fn, calls } = answers({ status: 200, body: { id: '1234567890', name: 'Waimers' } })
    const res = await verifyPixelToken({ pixelId: '1234567890', token: FAKE_TOKEN, fetch: fn })
    expect(res).toEqual({ ok: true, name: 'Waimers' })
    expect(calls).toHaveLength(1)
  })

  it('accepts a send-only token with one test event', async () => {
    const { fn, calls } = answers(missing, { status: 200, body: { events_received: 1 } })
    const res = await verifyPixelToken({ pixelId: '1234567890', token: FAKE_TOKEN, fetch: fn })
    expect(res).toEqual({ ok: true, name: null })
    expect(calls[1]?.url).toBe('https://graph.facebook.com/v26.0/1234567890/events')
    expect(JSON.parse(String(calls[1]?.init.body)).test_event_code).toBe('TOKENCHECK')
  })

  it('refuses a token that cannot send either', async () => {
    const { fn } = answers(missing, {
      status: 400,
      body: { error: { message: 'Invalid OAuth access token', code: 190 } },
    })
    const res = await verifyPixelToken({ pixelId: '1234567890', token: FAKE_TOKEN, fetch: fn })
    expect(res).toMatchObject({ ok: false, code: 190 })
  })

  it('does not send an event for any other refusal', async () => {
    const { fn, calls } = answers({
      status: 400,
      body: { error: { message: 'Invalid OAuth access token', code: 190 } },
    })
    const res = await verifyPixelToken({ pixelId: '1234567890', token: FAKE_TOKEN, fetch: fn })
    expect(res).toMatchObject({ ok: false, code: 190 })
    expect(calls).toHaveLength(1)
  })
})
