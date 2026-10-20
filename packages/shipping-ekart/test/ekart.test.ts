import { createHmac } from 'node:crypto'
import { describeShippingProvider, sampleShipment } from '@commerce/shipping/testing'
import { describe, expect, it } from 'vitest'
import { EkartProvider, ekartFactory } from '../src/ekart'
import { mapEkartStatus, scanDescription } from '../src/mapping'

type Route = (url: URL, init?: RequestInit) => Response | Promise<Response>

/** A fetch that records every call and answers from a route table (longest path first). */
function fakeFetch(routes: Record<string, Route>) {
  const calls: { url: URL; init?: RequestInit | undefined }[] = []
  const impl: typeof fetch = async (input, init) => {
    const url = new URL(
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
    )
    calls.push({ url, init })
    const route = Object.entries(routes)
      .sort(([a], [b]) => b.length - a.length)
      .find(([path]) => url.pathname.startsWith(path))?.[1]
    if (!route) return new Response('not found', { status: 404 })
    return route(url, init)
  }
  return { impl, calls }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

const bodyOf = (init?: RequestInit) => JSON.parse((init?.body as string) ?? '{}')
const headersOf = (init?: RequestInit) => (init?.headers ?? {}) as Record<string, string>

const config = {
  clientId: 'EKL123',
  username: 'waimers-api',
  password: 'ek-pass',
  originPincode: '131028',
  pickupAlias: 'Sonipat WH',
  sellerName: 'Waimers',
  sellerAddress: 'Plot 4, HSIIDC, Sonipat',
  sellerGstin: '06ABCDE1234F1Z5',
  webhookSecret: 'ek-hook-secret',
}

const token = () => json({ access_token: 'ek-token', expires_in: 86400, token_type: 'Bearer' })

const ack = (tracking_id = '500999A3408005') =>
  json({
    status: true,
    remark: 'Successfully created shipment',
    tracking_id,
    vendor: 'EKART',
    barcodes: { wbn: 'V123', order: '1' },
  })

describe('EkartProvider auth', () => {
  it('fetches a token with the client id in the path and reuses it', async () => {
    const f = fakeFetch({
      '/integrations/v2/auth/token/EKL123': token,
      '/api/v2/serviceability/': () =>
        json({ status: true, details: { cod: true, forward_drop: true } }),
      '/data/v3/serviceability': () => json([]),
    })
    const p = new EkartProvider({ ...config, fetchImpl: f.impl })
    await p.checkServiceability({ originPincode: '131028', destinationPincode: '560001' })
    await p.checkServiceability({ originPincode: '131028', destinationPincode: '110001' })
    const logins = f.calls.filter((c) => c.url.pathname.includes('/auth/token/'))
    expect(logins).toHaveLength(1)
    expect(bodyOf(logins[0]?.init)).toEqual({ username: 'waimers-api', password: 'ek-pass' })
    const lookup = f.calls.find((c) => c.url.pathname.startsWith('/api/v2/serviceability/'))
    expect(headersOf(lookup?.init).Authorization).toBe('Bearer ek-token')
  })

  it('answers a refused login with an actionable message', async () => {
    const f = fakeFetch({
      '/integrations/v2/auth/token/': () => new Response('no', { status: 401 }),
    })
    const r = await new EkartProvider({ ...config, fetchImpl: f.impl }).verifyCredentials()
    expect(r.ok).toBe(false)
    expect(r.message).toMatch(/onboarding/)
  })
})

describe('EkartProvider serviceability and rates', () => {
  it('reads COD from the pincode lookup and transit days from the route lookup', async () => {
    const f = fakeFetch({
      '/integrations/v2/auth/token/': token,
      '/api/v2/serviceability/560001': () =>
        json({ status: true, pincode: 560001, details: { cod: true, forward_drop: true } }),
      '/data/v3/serviceability': () =>
        json([
          { courierGroup: 'EKART_SURFACE', tat: { min: 3, max: 5 } },
          { courierGroup: 'EKART_EXPRESS', tat: { min: 2, max: 3 } },
        ]),
    })
    const p = new EkartProvider({ ...config, fetchImpl: f.impl })
    const r = await p.checkServiceability({ originPincode: '131028', destinationPincode: '560001' })
    expect(r).toMatchObject({
      serviceable: true,
      codAvailable: true,
      minTransitDays: 2,
      maxTransitDays: 5,
    })
  })

  it('stays serviceable with no transit days when the route lookup fails', async () => {
    const f = fakeFetch({
      '/integrations/v2/auth/token/': token,
      '/api/v2/serviceability/': () => json({ status: true, details: { cod: false } }),
      '/data/v3/serviceability': () => new Response('down', { status: 503 }),
    })
    const p = new EkartProvider({ ...config, fetchImpl: f.impl })
    const r = await p.checkServiceability({ originPincode: '131028', destinationPincode: '560001' })
    expect(r).toMatchObject({ serviceable: true, codAvailable: false, minTransitDays: null })
  })

  it('is unserviceable when Ekart says so', async () => {
    const f = fakeFetch({
      '/integrations/v2/auth/token/': token,
      '/api/v2/serviceability/': () => json({ status: false, remark: 'Pincode not serviceable' }),
    })
    const p = new EkartProvider({ ...config, fetchImpl: f.impl })
    const r = await p.checkServiceability({ originPincode: '131028', destinationPincode: '999999' })
    expect(r).toMatchObject({ serviceable: false, reason: 'Pincode not serviceable' })
  })

  it('quotes the cheapest delivered estimate, sending COD amount for COD', async () => {
    const f = fakeFetch({
      '/integrations/v2/auth/token/': token,
      '/data/v3/serviceability': () =>
        json([
          {
            tat: { min: 3, max: 5 },
            forwardDeliveredCharges: { totalForwardDeliveredEstimate: '72.40' },
          },
          {
            tat: { min: 2, max: 3 },
            forwardDeliveredCharges: { totalForwardDeliveredEstimate: '95.00' },
          },
        ]),
    })
    const p = new EkartProvider({ ...config, fetchImpl: f.impl })
    const q = await p.quoteRate({
      originPincode: '131028',
      destinationPincode: '560001',
      weightGrams: 450,
      declaredValuePaise: 199900,
      paymentMode: 'cod',
    })
    expect(q).toEqual({ pricePaise: 7240, minTransitDays: 3, maxTransitDays: 5 })
    const sent = bodyOf(f.calls.find((c) => c.url.pathname === '/data/v3/serviceability')?.init)
    expect(sent).toMatchObject({ paymentType: 'COD', codAmount: '1999', weight: '450' })
  })
})

describe('EkartProvider bookings', () => {
  it('books a COD shipment with the pickup alias and seller details', async () => {
    const f = fakeFetch({
      '/integrations/v2/auth/token/': token,
      '/api/v1/package/create': () => ack(),
    })
    const p = new EkartProvider({ ...config, fetchImpl: f.impl })
    const r = await p.createShipment({
      ...sampleShipment,
      paymentMode: 'cod',
      codAmountPaise: 199900,
    })
    expect(r).toEqual({ waybill: '500999A3408005', providerRef: 'V123' })
    const call = f.calls.find((c) => c.url.pathname === '/api/v1/package/create')
    expect(call?.init?.method).toBe('PUT')
    expect(bodyOf(call?.init)).toMatchObject({
      payment_mode: 'COD',
      cod_amount: 1999,
      total_amount: 1999,
      seller_gst_tin: '06ABCDE1234F1Z5',
      drop_location: { pin: 560001, phone: 9999999999, country: 'India' },
      pickup_location: { name: 'Sonipat WH' },
      return_location: { name: 'Sonipat WH' },
    })
  })

  it('leaves the pickup address out when no alias is set', async () => {
    const f = fakeFetch({
      '/integrations/v2/auth/token/': token,
      '/api/v1/package/create': () => ack(),
    })
    const p = new EkartProvider({ ...config, pickupAlias: '', fetchImpl: f.impl })
    await p.createShipment(sampleShipment)
    const sent = bodyOf(f.calls.find((c) => c.url.pathname === '/api/v1/package/create')?.init)
    expect(sent).toMatchObject({ payment_mode: 'Prepaid', cod_amount: 0 })
    expect(sent.pickup_location).toBeUndefined()
  })

  it('books a return as a Pickup shipment collected from the shopper', async () => {
    const f = fakeFetch({
      '/integrations/v2/auth/token/': token,
      '/api/v1/package/create': () => ack('R1'),
    })
    const p = new EkartProvider({ ...config, fetchImpl: f.impl })
    const r = await p.createReturnPickup({
      returnId: 'ret-1',
      reference: 'R-12-1044',
      orderNumber: 1044,
      from: sampleShipment.to,
      to: sampleShipment.from,
      lines: sampleShipment.lines,
      valuePaise: 199900,
      weightGrams: 500,
    })
    expect(r.waybill).toBe('R1')
    const sent = bodyOf(f.calls.find((c) => c.url.pathname === '/api/v1/package/create')?.init)
    expect(sent).toMatchObject({
      payment_mode: 'Pickup',
      return_reason: 'Customer return',
      drop_location: { pin: 560001 },
      order_number: 'R-12-1044',
    })
  })

  it('surfaces a refused booking as rejected', async () => {
    const f = fakeFetch({
      '/integrations/v2/auth/token/': token,
      '/api/v1/package/create': () => json({ status: false, remark: 'Invalid drop pincode' }),
    })
    const p = new EkartProvider({ ...config, fetchImpl: f.impl })
    await expect(p.createShipment(sampleShipment)).rejects.toMatchObject({
      kind: 'rejected',
      message: expect.stringContaining('Invalid drop pincode'),
    })
  })

  it('cancels by tracking id with DELETE and reads the acknowledgement list', async () => {
    const f = fakeFetch({
      '/integrations/v2/auth/token/': token,
      '/api/v1/package/cancel': () =>
        json({ data: [{ status: true, tracking_id: 'T1', remark: 'ok' }] }),
    })
    const p = new EkartProvider({ ...config, fetchImpl: f.impl })
    await expect(p.cancel('T1')).resolves.toBeUndefined()
    const call = f.calls.find((c) => c.url.pathname === '/api/v1/package/cancel')
    expect(call?.init?.method).toBe('DELETE')
    expect(call?.url.searchParams.get('tracking_id')).toBe('T1')
  })

  it('rejects a cancel Ekart refuses', async () => {
    const f = fakeFetch({
      '/integrations/v2/auth/token/': token,
      '/api/v1/package/cancel': () => json({ data: [{ status: false, remark: 'Already picked' }] }),
    })
    const p = new EkartProvider({ ...config, fetchImpl: f.impl })
    await expect(p.cancel('T1')).rejects.toMatchObject({ kind: 'rejected' })
  })

  it('returns the manifest link and the label bytes', async () => {
    const f = fakeFetch({
      '/integrations/v2/auth/token/': token,
      '/data/v2/generate/manifest': () =>
        json({ ctime: 1, manifestNumber: 9, manifestDownloadUrl: 'https://ek/manifest.pdf' }),
      '/api/v1/package/label': () => new Response(new Uint8Array([37, 80, 68, 70])),
    })
    const p = new EkartProvider({ ...config, fetchImpl: f.impl })
    expect(await p.generateManifest(['T1'])).toBe('https://ek/manifest.pdf')
    expect(new Uint8Array(await p.downloadLabel(['T1']))).toEqual(new Uint8Array([37, 80, 68, 70]))
  })
})

describe('EkartProvider tracking', () => {
  it('tracks through the open API without a token', async () => {
    const f = fakeFetch({
      '/api/v1/track/T1': () =>
        json({
          _id: 'T1',
          edd: Date.UTC(2026, 9, 23, 6),
          track: {
            status: 'Out for Delivery',
            ctime: Date.UTC(2026, 9, 22, 4),
            desc: 'Out for delivery',
            details: [
              {
                status: 'Out for Delivery',
                ctime: Date.UTC(2026, 9, 22, 4),
                desc: 'Out for delivery',
                location: 'Bengaluru',
              },
              {
                status: 'Picked Up',
                ctime: Date.UTC(2026, 9, 19, 10),
                desc: 'Picked up',
                location: 'Sonipat',
              },
            ],
          },
        }),
    })
    const p = new EkartProvider({ ...config, fetchImpl: f.impl })
    const t = await p.track('T1')
    expect(t).toMatchObject({
      status: 'out_for_delivery',
      expectedDate: '2026-10-23',
      trackingUrl: 'https://app.elite.ekartlogistics.in/track/T1',
    })
    expect(t.events.map((e) => e.status)).toEqual(['picked_up', 'out_for_delivery'])
    expect(f.calls.some((c) => c.url.pathname.includes('/auth/token/'))).toBe(false)
    expect(headersOf(f.calls[0]?.init).Authorization).toBeUndefined()
  })

  it('maps the documented statuses', () => {
    expect(mapEkartStatus('Delivered')).toBe('delivered')
    expect(mapEkartStatus('RTO Delivered')).toBe('rto')
    expect(mapEkartStatus('Seller RTO Requested')).toBe('rto')
    expect(mapEkartStatus('Seller Cancelled')).toBe('cancelled')
    expect(mapEkartStatus('Pickup Scheduled')).toBe('created')
    expect(mapEkartStatus('Undelivered')).toBe('in_transit')
    expect(mapEkartStatus('Something New')).toBe('in_transit')
  })
})

describe('EkartProvider NDR', () => {
  it('sends a re-attempt with a new phone, and RTO', async () => {
    const f = fakeFetch({
      '/integrations/v2/auth/token/': token,
      '/api/v2/package/ndr': () => json({ status: true, tracking_id: 'T1', remark: 'ok' }),
    })
    const p = new EkartProvider({ ...config, fetchImpl: f.impl })
    await p.ndrAction({
      waybill: 'T1',
      action: 'change_address',
      phone: '98765 43210',
      deferredDate: '2026-10-22',
    })
    await p.ndrAction({ waybill: 'T1', action: 'rto' })
    const sent = f.calls
      .filter((c) => c.url.pathname === '/api/v2/package/ndr')
      .map((c) => bodyOf(c.init))
    expect(sent[0]).toMatchObject({ action: 'Re-Attempt', wbn: 'T1', phone: '9876543210' })
    expect(sent[0].date).toBe(new Date('2026-10-22T10:00:00+05:30').getTime())
    expect(sent[1]).toEqual({ action: 'RTO', wbn: 'T1' })
  })
})

describe('EkartProvider webhook', () => {
  const rawBody = JSON.stringify({
    ctime: 1657523187604,
    status: 'Delivered',
    wbn: '3180',
    id: 'T1',
  })
  const hex = (secret: string) => createHmac('sha256', secret).update(rawBody).digest('hex')

  it('accepts a signed track_updated push and returns the tracking id', async () => {
    const p = new EkartProvider(config)
    const notices = await p.parseWebhook({
      rawBody,
      headers: { 'x-ekart-signature': hex(config.webhookSecret) },
    })
    expect(notices).toEqual([{ waybill: 'T1', eventId: 'T1:Delivered:1657523187604' }])
  })

  it('refuses an unsigned, wrongly signed or unconfigured push', async () => {
    const p = new EkartProvider(config)
    await expect(p.parseWebhook({ rawBody, headers: {} })).rejects.toMatchObject({ kind: 'auth' })
    await expect(
      p.parseWebhook({ rawBody, headers: { 'x-ekart-signature': hex('nope') } }),
    ).rejects.toMatchObject({ kind: 'auth' })
    const bare = new EkartProvider({ ...config, webhookSecret: undefined })
    await expect(
      bare.parseWebhook({ rawBody, headers: { 'x-ekart-signature': hex(config.webhookSecret) } }),
    ).rejects.toMatchObject({ kind: 'auth' })
  })
})

describe('ekartFactory', () => {
  it('validates the fields', () => {
    expect(ekartFactory.validateConfig(config).ok).toBe(true)
    const bad = ekartFactory.validateConfig({
      ...config,
      clientId: '',
      sellerGstin: 'short',
      webhookSecret: 'abc',
      baseUrl: 'https://evil.example.com',
    })
    expect(bad.ok).toBe(false)
    if (!bad.ok) expect(bad.errors).toHaveLength(4)
  })

  it('flags the password and webhook secret as secret', () => {
    expect(ekartFactory.fields.filter((f) => f.secret).map((f) => f.key)).toEqual([
      'password',
      'webhookSecret',
    ])
  })
})

describe('Ekart scan wording for NDR', () => {
  it('marks a scan with an NDR status so the NDR queue picks it up', () => {
    expect(
      scanDescription({
        status: 'In Transit',
        desc: 'Attempted',
        ndrStatus: 'Customer Unavailable',
      }),
    ).toBe('Undelivered: Customer Unavailable, Attempted')
    expect(scanDescription({ status: 'Undelivered', desc: 'Undelivered' })).toBe('Undelivered')
    expect(scanDescription({ status: 'In Transit', desc: 'Bag received' })).toBe('Bag received')
  })
})

describeShippingProvider('ekart (offline)', {
  create: () =>
    new EkartProvider({
      ...config,
      fetchImpl: async () => {
        throw new TypeError('network down')
      },
    }),
})
