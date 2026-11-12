import { CourierError } from '@commerce/shipping'
import { describeShippingProvider, sampleShipment } from '@commerce/shipping/testing'
import { describe, expect, it } from 'vitest'
import { mapDtdcStatus, parseDtdcDate, readPincode } from '../src/api'
import { DtdcProvider, dtdcFactory } from '../src/dtdc'

type Route = (url: URL, init?: RequestInit) => Response | Promise<Response>

/** A fetch that records every call and answers from a route table keyed by host + path. */
function fakeFetch(routes: Record<string, Route>) {
  const calls: { url: URL; init?: RequestInit | undefined }[] = []
  const impl: typeof fetch = async (input, init) => {
    const url = new URL(
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
    )
    calls.push({ url, init })
    const route = Object.entries(routes).find(([key]) =>
      `${url.host}${url.pathname}`.startsWith(key),
    )?.[1]
    if (!route) return new Response('not found', { status: 404 })
    return route(url, init)
  }
  return { impl, calls }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

const pdf = () =>
  new Response(new TextEncoder().encode('%PDF-1.4 dtdc'), {
    headers: { 'content-type': 'application/pdf' },
  })

const bodyOf = (init?: RequestInit) => JSON.parse((init?.body as string) ?? '{}')
const headerOf = (init: RequestInit | undefined, name: string) =>
  (init?.headers as Record<string, string> | undefined)?.[name]

const SOFTDATA = 'dtdcapi.shipsy.io/api/customer/integration/consignment/softdata'
const LABEL = 'dtdcapi.shipsy.io/api/customer/integration/consignment/shippinglabel/stream'
const CANCEL = 'dtdcapi.shipsy.io/api/customer/integration/consignment/cancel'
const PINCODE = 'smarttrack.ctbsplus.dtdc.com/ratecalapi/PincodeApiCall'
const AUTH = 'blktracksvc.dtdc.com/dtdc-api/api/dtdc/authenticate'
const TRACK = 'blktracksvc.dtdc.com/dtdc-api/rest/JSONCnTrk/getTrackDetails'

let user = 0
/** A fresh tracking login per test: the tracking token cache is shared by login. */
const config = () => ({
  apiKey: 'dtdc-key',
  customerCode: 'GL017',
  originPincode: '131028',
  trackingUsername: `track-${++user}`,
  trackingPassword: 'pw',
})

describe('DtdcProvider serviceability', () => {
  it('reads the service flag and COD from the public PIN code lookup', async () => {
    const f = fakeFetch({
      [PINCODE]: () =>
        json({
          ZIPCODE_RESP: [{ PIN: '560001', SERVFLAG: 'Y', MESSAGE: 'SUCCESS' }],
          SERV_LIST_DTLS: [{ NAME: 'B2C PRIORITY', b2C_COD_SERV: 'Y' }],
        }),
    })
    const p = new DtdcProvider({ ...config(), fetchImpl: f.impl })
    const r = await p.checkServiceability({ originPincode: '131028', destinationPincode: '560001' })
    expect(r).toMatchObject({
      provider: 'dtdc',
      serviceable: true,
      codAvailable: true,
      minTransitDays: null,
    })
    expect(bodyOf(f.calls[0]?.init)).toEqual({ orgPincode: '131028', desPincode: '560001' })
  })

  it('is unserviceable, not an error, when DTDC says N', async () => {
    const f = fakeFetch({
      [PINCODE]: () => json({ ZIPCODE_RESP: [{ PIN: '744101', SERVFLAG: 'N' }] }),
    })
    const p = new DtdcProvider({ ...config(), fetchImpl: f.impl })
    const r = await p.checkServiceability({ originPincode: '131028', destinationPincode: '744101' })
    expect(r.serviceable).toBe(false)
    expect(r.codAvailable).toBe(false)
    expect(r.reason).toMatch(/does not currently deliver/)
  })

  it('declares that its lookup proves nothing about the key', () => {
    expect(dtdcFactory.serviceabilityWithoutCredentials).toBe(true)
  })
})

describe('DtdcProvider bookings', () => {
  it('books a COD consignment with the api-key header and keeps the label PDF', async () => {
    const f = fakeFetch({
      [SOFTDATA]: () =>
        json({ status: 'OK', data: [{ success: true, reference_number: 'D1005560078' }] }),
      [LABEL]: () => pdf(),
    })
    const p = new DtdcProvider({ ...config(), fetchImpl: f.impl })
    const r = await p.createShipment({
      ...sampleShipment,
      paymentMode: 'cod',
      codAmountPaise: 149900,
    })
    expect(r.waybill).toBe('D1005560078')
    expect(r.providerRef).toBe('D1005560078')
    expect(new TextDecoder().decode(r.labelDocument?.body)).toBe('%PDF-1.4 dtdc')

    const booking = f.calls.find((c) => `${c.url.host}${c.url.pathname}` === SOFTDATA)
    expect(headerOf(booking?.init, 'api-key')).toBe('dtdc-key')
    const consignment = bodyOf(booking?.init).consignments[0]
    expect(consignment).toMatchObject({
      customer_code: 'GL017',
      service_type_id: 'B2C PRIORITY',
      load_type: 'NON-DOCUMENT',
      cod_collection_mode: 'cash',
      cod_amount: '1499.00',
      declared_value: '1999.00',
      weight: '0.500',
      customer_reference_number: '1',
    })
    expect(consignment.destination_details).toMatchObject({
      pincode: '560001',
      phone: '9999999999',
    })
    const label = f.calls.find((c) => `${c.url.host}${c.url.pathname}` === LABEL)
    expect(label?.url.searchParams.get('reference_number')).toBe('D1005560078')
    expect(label?.url.searchParams.get('label_format')).toBe('pdf')
  })

  it('books prepaid with no COD fields and a configured service type', async () => {
    const f = fakeFetch({
      [SOFTDATA]: () => json({ status: 'OK', data: [{ success: true, reference_number: 'D1' }] }),
      [LABEL]: () => json({ label: Buffer.from('%PDF').toString('base64') }),
    })
    const p = new DtdcProvider({ ...config(), serviceType: 'GROUND EXPRESS', fetchImpl: f.impl })
    const r = await p.createShipment(sampleShipment)
    expect(new TextDecoder().decode(r.labelDocument?.body)).toBe('%PDF')
    const consignment = bodyOf(f.calls[0]?.init).consignments[0]
    expect(consignment).toMatchObject({
      service_type_id: 'GROUND EXPRESS',
      cod_collection_mode: '',
      cod_amount: '',
    })
  })

  it('keeps the booking when the label call fails', async () => {
    const f = fakeFetch({
      [SOFTDATA]: () => json({ status: 'OK', data: [{ success: true, reference_number: 'D2' }] }),
      [LABEL]: () => new Response('boom', { status: 500 }),
    })
    const p = new DtdcProvider({ ...config(), fetchImpl: f.impl })
    const r = await p.createShipment(sampleShipment)
    expect(r.waybill).toBe('D2')
    expect(r.labelDocument).toBeUndefined()
  })

  it('surfaces DTDC’s reason for a refused booking', async () => {
    const f = fakeFetch({
      [SOFTDATA]: () =>
        json({
          status: 'OK',
          data: [{ success: false, message: 'Destination pincode not serviceable' }],
        }),
    })
    const p = new DtdcProvider({ ...config(), fetchImpl: f.impl })
    const err = await p.createShipment(sampleShipment).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(CourierError)
    expect((err as CourierError).kind).toBe('rejected')
    expect((err as CourierError).message).toMatch(/not serviceable/)
  })

  it('cancels by AWB with the customer code and reports a failure', async () => {
    const f = fakeFetch({
      [CANCEL]: (_url, init) =>
        bodyOf(init).AWBNo[0] === 'bad'
          ? json({
              status: 'OK',
              success: false,
              failures: [{ reference_number: 'bad', reason: 'Already picked up' }],
            })
          : json({ status: 'OK', success: true, successConsignments: ['D1'] }),
    })
    const p = new DtdcProvider({ ...config(), fetchImpl: f.impl })
    await expect(p.cancel('D1')).resolves.toBeUndefined()
    expect(bodyOf(f.calls[0]?.init)).toEqual({ AWBNo: ['D1'], customerCode: 'GL017' })
    await expect(p.cancel('bad')).rejects.toThrow(/Already picked up/)
  })
})

describe('DtdcProvider tracking', () => {
  const trackBody = {
    statusCode: 200,
    statusFlag: true,
    trackHeader: {
      strShipmentNo: 'D1',
      strStatus: 'Delivered',
      strExpectedDeliveryDate: '23102026',
    },
    trackDetails: [
      {
        strCode: 'DLV',
        strAction: 'Delivered',
        strOrigin: 'Bangalore',
        strActionDate: '23102026',
        strActionTime: '1415',
      },
      {
        strCode: 'BKD',
        strAction: 'Booked',
        strOrigin: 'Sonipat',
        strActionDate: '20102026',
        strActionTime: '1730',
      },
    ],
  }

  it('logs in to the tracking service once and reads scans oldest first', async () => {
    let logins = 0
    const f = fakeFetch({
      [AUTH]: () => {
        logins++
        return new Response('trk-token')
      },
      [TRACK]: () => json(trackBody),
    })
    const p = new DtdcProvider({ ...config(), fetchImpl: f.impl })
    const t = await p.track('D1')
    await p.track('D1')
    expect(logins).toBe(1)
    expect(t.status).toBe('delivered')
    expect(t.events.map((e) => e.status)).toEqual(['picked_up', 'delivered'])
    expect(t.events[0]?.at).toBe('2026-10-20T12:00:00.000Z')
    expect(t.expectedDate).toBe('2026-10-23')
    const call = f.calls.find((c) => `${c.url.host}${c.url.pathname}` === TRACK)
    expect(headerOf(call?.init, 'X-Access-Token')).toBe('trk-token')
    expect(bodyOf(call?.init)).toEqual({ trkType: 'cnno', strcnno: 'D1', addtnlDtl: 'Y' })
  })

  it('never reuses a token logged in with the same username but another password', async () => {
    let logins = 0
    const f = fakeFetch({
      [AUTH]: (url) => {
        logins++
        return new Response(`trk-for-${url.searchParams.get('password')}`)
      },
      [TRACK]: () => json(trackBody),
    })
    const shared = config()
    await new DtdcProvider({ ...shared, fetchImpl: f.impl }).track('D1')
    await new DtdcProvider({ ...shared, trackingPassword: 'new-pw', fetchImpl: f.impl }).track('D1')
    expect(logins).toBe(2)
    const sent = f.calls
      .filter((c) => `${c.url.host}${c.url.pathname}` === TRACK)
      .map((c) => headerOf(c.init, 'X-Access-Token'))
    expect(sent).toEqual(['trk-for-pw', 'trk-for-new-pw'])
    // The same login again still shares the first token.
    await new DtdcProvider({ ...shared, fetchImpl: f.impl }).track('D1')
    expect(logins).toBe(2)
  })

  it('logs in again once when the tracking token is refused', async () => {
    let logins = 0
    const f = fakeFetch({
      [AUTH]: () => new Response(`trk-${++logins}`),
      [TRACK]: (_url, init) =>
        headerOf(init, 'X-Access-Token') === 'trk-1'
          ? new Response('expired', { status: 401 })
          : json(trackBody),
    })
    const p = new DtdcProvider({ ...config(), fetchImpl: f.impl })
    const t = await p.track('D1')
    expect(t.status).toBe('delivered')
    expect(logins).toBe(2)
  })

  it('says what is missing when no tracking login is configured', async () => {
    const f = fakeFetch({})
    const p = new DtdcProvider({
      apiKey: 'k',
      customerCode: 'GL017',
      originPincode: '131028',
      fetchImpl: f.impl,
    })
    const err = await p.track('D1').catch((e: unknown) => e)
    expect((err as CourierError).kind).toBe('not_configured')
    expect(f.calls).toHaveLength(0)
  })
})

describe('DtdcProvider verifyCredentials', () => {
  it('accepts a key DTDC answers with not-found for a probe consignment', async () => {
    const f = fakeFetch({
      [LABEL]: () => json({ message: 'Consignment not found' }, 404),
      [AUTH]: () => new Response('trk-token'),
    })
    const p = new DtdcProvider({ ...config(), fetchImpl: f.impl })
    const r = await p.verifyCredentials()
    expect(r.ok).toBe(true)
  })

  it('names the API key when DTDC refuses it', async () => {
    const f = fakeFetch({ [LABEL]: () => new Response('no', { status: 401 }) })
    const p = new DtdcProvider({ ...config(), fetchImpl: f.impl })
    const r = await p.verifyCredentials()
    expect(r.ok).toBe(false)
    expect(r.message).toMatch(/API key/)
  })

  it('names the tracking login when that is what fails', async () => {
    const f = fakeFetch({
      [LABEL]: () => json({ message: 'not found' }, 404),
      [AUTH]: () => new Response('no', { status: 401 }),
    })
    const p = new DtdcProvider({ ...config(), fetchImpl: f.impl })
    const r = await p.verifyCredentials()
    expect(r.ok).toBe(false)
    expect(r.message).toMatch(/tracking username or password/)
  })
})

describe('DTDC wire helpers', () => {
  it.each([
    ['DLV', 'Delivered', 'delivered'],
    ['NONDLV', 'Not Delivered', 'in_transit'],
    ['RTO', 'RTO In Transit', 'rto'],
    ['', 'Out For Delivery', 'out_for_delivery'],
    ['BKD', 'Booked', 'picked_up'],
    ['', 'Softdata Upload', 'created'],
    ['', 'In Transit', 'in_transit'],
  ] as const)('maps %s / %s to %s', (code, text, status) => {
    expect(mapDtdcStatus(code, text)).toBe(status)
  })

  it('reads ddMMyyyy + HHmm as India time', () => {
    expect(parseDtdcDate('20102026', '1730')).toBe('2026-10-20T12:00:00.000Z')
    expect(parseDtdcDate('2026-10-20')).toBeNull()
  })

  it('picks the destination row out of a multi-PIN answer', () => {
    const r = readPincode(
      {
        ZIPCODE_RESP: [
          { PIN: '131028', SERVFLAG: 'Y' },
          { PIN: '744101', SERVFLAG: 'N' },
        ],
      },
      '744101',
    )
    expect(r.serviceable).toBe(false)
  })
})

describe('dtdcFactory', () => {
  const raw = { apiKey: 'k', customerCode: 'GL017', originPincode: '131028' }

  it('flags the API key and tracking password as secrets', () => {
    const secret = dtdcFactory.fields.filter((f) => f.secret).map((f) => f.key)
    expect(secret.sort()).toEqual(['apiKey', 'trackingPassword'])
  })

  it('needs both halves of the tracking login, and a Shipsy base URL', () => {
    expect(dtdcFactory.validateConfig(raw).ok).toBe(true)
    const half = dtdcFactory.validateConfig({ ...raw, trackingUsername: 'u' })
    expect(half.ok).toBe(false)
    const off = dtdcFactory.validateConfig({ ...raw, baseUrl: 'https://evil.example' })
    expect(off.ok).toBe(false)
    const demo = dtdcFactory.validateConfig({
      ...raw,
      baseUrl: 'https://demodashboardapi.shipsy.in',
    })
    expect(demo.ok).toBe(true)
  })
})

describeShippingProvider('dtdc (offline)', {
  create: () =>
    new DtdcProvider({
      ...config(),
      fetchImpl: async () => {
        throw new TypeError('offline')
      },
    }),
})
