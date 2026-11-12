import { CourierError } from '@commerce/shipping'
import { describeShippingProvider, sampleShipment } from '@commerce/shipping/testing'
import { describe, expect, it } from 'vitest'
import { addressLines, mapBluedartStatus, parseBluedartDate, pickupSlot } from '../src/api'
import { BluedartProvider, bluedartFactory } from '../src/bluedart'

type Route = (url: URL, init?: RequestInit) => Response | Promise<Response>

/** A fetch that records every call and answers from a route table (longest path wins). */
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

const TOKEN = '/in/transportation/token/v1/login'
const PINCODE = '/in/transportation/finder/v1/GetServicesforPincode'
const TRANSIT = '/in/transportation/transit/v1/GetDomesticTransitTimeForPinCodeandProduct'
const WAYBILL = '/in/transportation/waybill/v1/GenerateWayBill'
const CANCEL = '/in/transportation/waybill/v1/CancelWaybill'
const PICKUP = '/in/transportation/pickup/v1/RegisterPickup'
const TRACKING = '/in/transportation/tracking/v1'

let app = 0
/** A fresh gateway app per test: the JWT cache is shared by every provider with the same keys. */
const config = () => ({
  clientId: `client-${++app}`,
  clientSecret: 'secret',
  loginId: 'DEL12345',
  licenceKey: 'lic-key',
  customerCode: '123456',
  originArea: 'DEL',
  originPincode: '110030',
})

const tokenRoute: Route = () => json({ JWTToken: 'jwt-1' })

const NOW = new Date('2026-10-20T04:30:00Z') // 10:00 in India

describe('BluedartProvider auth', () => {
  it('mints a JWT from ClientID + clientSecret once and sends it on every call', async () => {
    const f = fakeFetch({
      [TOKEN]: tokenRoute,
      [PINCODE]: () => json({ GetServicesforPincodeResult: { AreaCode: 'BLR', IsError: false } }),
      [TRANSIT]: () => json({}),
    })
    const p = new BluedartProvider({ ...config(), fetchImpl: f.impl })
    await p.checkServiceability({ originPincode: '110030', destinationPincode: '560001' })
    await p.checkServiceability({ originPincode: '110030', destinationPincode: '560002' })
    const tokenCalls = f.calls.filter((c) => c.url.pathname === TOKEN)
    expect(tokenCalls).toHaveLength(1)
    const headers = tokenCalls[0]?.init?.headers as Record<string, string>
    expect(headers.ClientID).toMatch(/^client-/)
    expect(headers.clientSecret).toBe('secret')
    const lookup = f.calls.find((c) => c.url.pathname === PINCODE)
    expect((lookup?.init?.headers as Record<string, string> | undefined)?.JWTToken).toBe('jwt-1')
    expect(bodyOf(lookup?.init).profile).toEqual({
      LoginID: 'DEL12345',
      LicenceKey: 'lic-key',
      Api_type: 'S',
    })
  })

  it('never reuses a token minted for the same Client ID with a different secret', async () => {
    let issued = 0
    const f = fakeFetch({
      [TOKEN]: (_url, init) => {
        issued++
        const secret = (init?.headers as Record<string, string> | undefined)?.clientSecret
        return json({ JWTToken: `jwt-for-${secret}` })
      },
      [PINCODE]: () => json({ GetServicesforPincodeResult: { AreaCode: 'BLR', IsError: false } }),
      [TRANSIT]: () => json({}),
    })
    const shared = config()
    const ask = (p: BluedartProvider) =>
      p.checkServiceability({ originPincode: '110030', destinationPincode: '560001' })
    await ask(new BluedartProvider({ ...shared, fetchImpl: f.impl }))
    await ask(new BluedartProvider({ ...shared, clientSecret: 'changed', fetchImpl: f.impl }))
    expect(issued).toBe(2)
    const sent = f.calls
      .filter((c) => c.url.pathname === PINCODE)
      .map((c) => (c.init?.headers as Record<string, string> | undefined)?.JWTToken)
    expect(sent).toEqual(['jwt-for-secret', 'jwt-for-changed'])
    // The same keys again still share the first token.
    await ask(new BluedartProvider({ ...shared, fetchImpl: f.impl }))
    expect(issued).toBe(2)
  })

  it('mints a new token and retries once when the gateway answers 401', async () => {
    let issued = 0
    let lookups = 0
    const f = fakeFetch({
      [TOKEN]: () => json({ JWTToken: `jwt-${++issued}` }),
      [PINCODE]: (_url, init) => {
        lookups++
        const token = (init?.headers as Record<string, string> | undefined)?.JWTToken
        return token === 'jwt-1'
          ? new Response('expired', { status: 401 })
          : json({ GetServicesforPincodeResult: { AreaCode: 'BLR' } })
      },
      [TRANSIT]: () => json({}),
    })
    const p = new BluedartProvider({ ...config(), fetchImpl: f.impl })
    const r = await p.checkServiceability({ originPincode: '110030', destinationPincode: '560001' })
    expect(r.serviceable).toBe(true)
    expect(issued).toBe(2)
    expect(lookups).toBe(2)
  })

  it('verifyCredentials explains a rejected Client ID instead of throwing', async () => {
    const f = fakeFetch({ [TOKEN]: () => new Response('no', { status: 401 }) })
    const p = new BluedartProvider({ ...config(), fetchImpl: f.impl })
    const r = await p.verifyCredentials()
    expect(r.ok).toBe(false)
    expect(r.message).toMatch(/Client ID/)
  })
})

describe('BluedartProvider serviceability', () => {
  it('reads COD and transit days from the PIN code and transit answers', async () => {
    const f = fakeFetch({
      [TOKEN]: tokenRoute,
      [PINCODE]: () =>
        json({
          GetServicesforPincodeResult: {
            AreaCode: 'BLR',
            ApexInbound: 'Yes',
            eTailCODAirInbound: 'Yes',
            eTailPrePaidAirInbound: 'Yes',
            IsError: false,
          },
        }),
      [TRANSIT]: () =>
        json({
          GetDomesticTransitTimeForPinCodeandProductResult: {
            ExpectedDateDelivery: '23-Oct-2026',
            IsError: false,
          },
        }),
    })
    const p = new BluedartProvider({ ...config(), fetchImpl: f.impl, now: () => NOW })
    const r = await p.checkServiceability({ originPincode: '110030', destinationPincode: '560001' })
    expect(r).toMatchObject({
      provider: 'bluedart',
      serviceable: true,
      codAvailable: true,
      prepaidAvailable: true,
      minTransitDays: 3,
      maxTransitDays: 3,
    })
    const transit = bodyOf(f.calls.find((c) => c.url.pathname === TRANSIT)?.init)
    expect(transit).toMatchObject({ ppinCode: '110030', pPinCodeTo: '560001', pProductCode: 'A' })
  })

  it('is unserviceable, not an error, for a PIN Blue Dart rejects or does not serve', async () => {
    const f = fakeFetch({
      [TOKEN]: tokenRoute,
      [PINCODE]: (_url, init) =>
        bodyOf(init).pinCode === '999999'
          ? json(
              {
                'error-response': [
                  { IsError: true, Status: [{ StatusInformation: 'Invalid Pincode' }] },
                ],
              },
              400,
            )
          : json({
              GetServicesforPincodeResult: {
                AreaCode: 'PBL',
                ApexInbound: 'No',
                eTailCODAirInbound: 'No',
                eTailPrePaidAirInbound: 'No',
              },
            }),
    })
    const p = new BluedartProvider({ ...config(), fetchImpl: f.impl })
    const unknown = await p.checkServiceability({
      originPincode: '110030',
      destinationPincode: '999999',
    })
    const closed = await p.checkServiceability({
      originPincode: '110030',
      destinationPincode: '744101',
    })
    expect(unknown.serviceable).toBe(false)
    expect(closed.serviceable).toBe(false)
    expect(closed.reason).toMatch(/does not currently deliver/)
  })

  it('keeps the serviceability answer when the transit call fails', async () => {
    const f = fakeFetch({
      [TOKEN]: tokenRoute,
      [PINCODE]: () =>
        json({ GetServicesforPincodeResult: { AreaCode: 'BLR', ApexInbound: 'Yes' } }),
      [TRANSIT]: () => new Response('boom', { status: 500 }),
    })
    const p = new BluedartProvider({ ...config(), fetchImpl: f.impl })
    const r = await p.checkServiceability({ originPincode: '110030', destinationPincode: '560001' })
    expect(r.serviceable).toBe(true)
    expect(r.minTransitDays).toBeNull()
    expect(r.codAvailable).toBe(false)
  })
})

describe('BluedartProvider waybills', () => {
  it('books a COD shipment with the collectable amount and returns the label PDF', async () => {
    const pdf = Buffer.from('%PDF-1.4 label').toString('base64')
    const f = fakeFetch({
      [TOKEN]: tokenRoute,
      [WAYBILL]: () =>
        json({
          GenerateWayBillResult: {
            AWBNo: '76662235090',
            AWBPrintContent: pdf,
            IsError: false,
            Status: [{ StatusCode: 'Valid', StatusInformation: 'Waybill Generation Sucessful' }],
          },
        }),
    })
    const p = new BluedartProvider({ ...config(), fetchImpl: f.impl, now: () => NOW })
    const r = await p.createShipment({
      ...sampleShipment,
      paymentMode: 'cod',
      codAmountPaise: 149900,
      to: {
        ...sampleShipment.to,
        line1: 'Flat 1203, Prestige Shantiniketan Tower B, Whitefield Main Road',
      },
    })
    expect(r.waybill).toBe('76662235090')
    expect(r.providerRef).toBe('76662235090')
    expect(Buffer.from(r.labelDocument?.body ?? []).toString()).toBe('%PDF-1.4 label')
    const sent = bodyOf(f.calls.find((c) => c.url.pathname === WAYBILL)?.init)
    expect(sent.Profile.LicenceKey).toBe('lic-key')
    expect(sent.Request.Services).toMatchObject({
      ProductCode: 'A',
      SubProductCode: 'C',
      CollectableAmount: 1499,
      DeclaredValue: 1999,
      ActualWeight: 0.5,
      RegisterPickup: true,
      PickupTime: '1600',
    })
    expect(sent.Request.Services.CreditReferenceNo.length).toBeLessThanOrEqual(20)
    expect(sent.Request.Shipper).toMatchObject({ CustomerCode: '123456', OriginArea: 'DEL' })
    for (const key of ['ConsigneeAddress1', 'ConsigneeAddress2', 'ConsigneeAddress3']) {
      expect(sent.Request.Consignee[key].length).toBeLessThanOrEqual(30)
    }
  })

  it('books prepaid with SubProductCode P and no collectable amount, label as a byte array', async () => {
    const f = fakeFetch({
      [TOKEN]: tokenRoute,
      [WAYBILL]: () =>
        json({ GenerateWayBillResult: { AWBNo: '111', AWBPrintContent: [37, 80, 68, 70] } }),
    })
    const p = new BluedartProvider({ ...config(), fetchImpl: f.impl, now: () => NOW })
    const r = await p.createShipment(sampleShipment)
    expect(Buffer.from(r.labelDocument?.body ?? []).toString()).toBe('%PDF')
    const sent = bodyOf(f.calls.find((c) => c.url.pathname === WAYBILL)?.init)
    expect(sent.Request.Services).toMatchObject({ SubProductCode: 'P', CollectableAmount: 0 })
  })

  it('surfaces Blue Dart’s own reason for a refused waybill', async () => {
    const f = fakeFetch({
      [TOKEN]: tokenRoute,
      [WAYBILL]: () =>
        json(
          {
            'error-response': [
              { IsError: true, Status: [{ StatusInformation: 'InvalidAreaScNotInRegion' }] },
            ],
          },
          400,
        ),
    })
    const p = new BluedartProvider({ ...config(), fetchImpl: f.impl })
    const err = await p.createShipment(sampleShipment).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(CourierError)
    expect((err as CourierError).kind).toBe('rejected')
    expect((err as CourierError).message).toMatch(/InvalidAreaScNotInRegion.*origin area code/)
  })

  it('treats IsError in a 200 answer as a rejection', async () => {
    const f = fakeFetch({
      [TOKEN]: tokenRoute,
      [WAYBILL]: () =>
        json({
          GenerateWayBillResult: {
            IsError: true,
            Status: [{ StatusInformation: 'Waybill already generated' }],
          },
        }),
    })
    const p = new BluedartProvider({ ...config(), fetchImpl: f.impl })
    await expect(p.createShipment(sampleShipment)).rejects.toThrow(/already generated/)
  })

  it('cancels by AWB and reports a refusal', async () => {
    const f = fakeFetch({
      [TOKEN]: tokenRoute,
      [CANCEL]: (_url, init) =>
        bodyOf(init).Request.AWBNo === 'bad'
          ? json({
              CancelWaybillResult: {
                IsError: true,
                Status: [{ StatusInformation: 'Shipment already picked up' }],
              },
            })
          : json({ CancelWaybillResult: { IsError: false, AWBNo: '111' } }),
    })
    const p = new BluedartProvider({ ...config(), fetchImpl: f.impl })
    await expect(p.cancel('111')).resolves.toBeUndefined()
    await expect(p.cancel('bad')).rejects.toThrow(/already picked up/)
  })
})

describe('BluedartProvider pickup', () => {
  it('registers a pickup and returns its token number', async () => {
    const f = fakeFetch({
      [TOKEN]: tokenRoute,
      [PICKUP]: () => json({ RegisterPickupResult: { TokenNumber: 987654, IsError: false } }),
    })
    const p = new BluedartProvider({
      ...config(),
      pickupAddress: 'Plot 4, HSIIDC Industrial Estate, Rai, Sonipat',
      pickupPhone: '+91 99999 99998',
      fetchImpl: f.impl,
    })
    const r = await p.schedulePickup({
      pickupLocationName: 'Waimers',
      date: '2026-10-21',
      timeFrom: '14:00',
      expectedPackageCount: 3,
    })
    expect(r.providerPickupId).toBe('987654')
    const sent = bodyOf(f.calls.find((c) => c.url.pathname === PICKUP)?.init)
    expect(sent.request).toMatchObject({
      AreaCode: 'DEL',
      CustomerCode: '123456',
      MobileTelNo: '9999999998',
      NumberofPieces: 3,
      ShipmentPickupTime: '14:00',
    })
    expect(sent.request.ShipmentPickupDate).toBe(`/Date(${Date.UTC(2026, 9, 21)})/`)
  })

  it('asks for the pickup address instead of calling Blue Dart without one', async () => {
    const f = fakeFetch({ [TOKEN]: tokenRoute })
    const p = new BluedartProvider({ ...config(), fetchImpl: f.impl })
    await expect(
      p.schedulePickup({
        pickupLocationName: 'W',
        date: '2026-10-21',
        timeFrom: '14:00',
        expectedPackageCount: 1,
      }),
    ).rejects.toThrow(/pickup address/)
    expect(f.calls).toHaveLength(0)
  })
})

describe('BluedartProvider tracking', () => {
  it('reads status and scans oldest first, with the licence key in the query', async () => {
    const f = fakeFetch({
      [TOKEN]: tokenRoute,
      [TRACKING]: () =>
        json({
          ShipmentData: {
            Shipment: [
              {
                WaybillNo: '111',
                Status: 'SHIPMENT DELIVERED',
                StatusType: 'DL',
                ExpectedDeliveryDate: '23 October 2026',
                Scans: [
                  {
                    ScanDetail: {
                      Scan: 'SHIPMENT DELIVERED',
                      ScanType: 'DL',
                      ScanDate: '23-Oct-2026',
                      ScanTime: '1415',
                      ScannedLocation: 'BANGALORE',
                    },
                  },
                  {
                    ScanDetail: {
                      Scan: 'SHIPMENT PICKED UP',
                      ScanType: 'PU',
                      ScanDate: '20-Oct-2026',
                      ScanTime: '1730',
                      ScannedLocation: 'DELHI',
                    },
                  },
                ],
              },
            ],
          },
        }),
    })
    const p = new BluedartProvider({ ...config(), fetchImpl: f.impl })
    const t = await p.track('111')
    expect(t.status).toBe('delivered')
    expect(t.events.map((e) => e.status)).toEqual(['picked_up', 'delivered'])
    expect(t.events[0]?.at).toBe('2026-10-20T12:00:00.000Z')
    expect(t.expectedDate).toBe('2026-10-23')
    const q = f.calls.find((c) => c.url.pathname === TRACKING)?.url.searchParams
    expect(q?.get('numbers')).toBe('111')
    expect(q?.get('lickey')).toBe('lic-key')
    expect(q?.get('action')).toBe('custawbquery')
  })

  it('throws bad_response for an unknown waybill', async () => {
    const f = fakeFetch({ [TOKEN]: tokenRoute, [TRACKING]: () => json({ ShipmentData: {} }) })
    const p = new BluedartProvider({ ...config(), fetchImpl: f.impl })
    await expect(p.track('000')).rejects.toBeInstanceOf(CourierError)
  })
})

describe('Blue Dart wire helpers', () => {
  it.each([
    ['DL', 'SHIPMENT DELIVERED', 'delivered'],
    ['UD', 'CONSIGNEE NOT AVAILABLE', 'in_transit'],
    ['UD', 'SHIPMENT NOT DELIVERED', 'in_transit'],
    ['RT', 'RETURNED TO ORIGIN', 'rto'],
    ['IT', 'SHIPMENT OUT FOR DELIVERY', 'out_for_delivery'],
    ['PU', 'SHIPMENT PICKED UP', 'picked_up'],
    ['', 'Shipment Data Received', 'created'],
    ['IT', 'IN TRANSIT', 'in_transit'],
  ] as const)('maps %s / %s to %s', (type, text, status) => {
    expect(mapBluedartStatus(type, text)).toBe(status)
  })

  it('reads .NET and named-month dates as India time', () => {
    expect(parseBluedartDate('/Date(1792468800000)/')).toBe(new Date(1792468800000).toISOString())
    expect(parseBluedartDate('20-Oct-2026', '17:30')).toBe('2026-10-20T12:00:00.000Z')
    expect(parseBluedartDate('nonsense')).toBeNull()
  })

  it('splits an address into three lines of at most 30 characters', () => {
    const lines = addressLines(
      'Flat 1203, Prestige Shantiniketan Tower B',
      'Whitefield Main Road, Hoodi',
    )
    expect(lines.every((l) => l.length <= 30)).toBe(true)
    expect(lines.join(' ')).toContain('Whitefield')
  })

  it('books the pickup for today before 14:00 India time, tomorrow after', () => {
    expect(pickupSlot(new Date('2026-10-20T04:30:00Z')).date.toISOString()).toBe(
      '2026-10-20T00:00:00.000Z',
    )
    expect(pickupSlot(new Date('2026-10-20T10:00:00Z')).date.toISOString()).toBe(
      '2026-10-21T00:00:00.000Z',
    )
  })
})

describe('bluedartFactory', () => {
  const raw = {
    clientId: 'c',
    clientSecret: 's',
    loginId: 'l',
    licenceKey: 'k',
    customerCode: '123',
    originArea: 'del',
    originPincode: '110030',
  }

  it('flags the client secret and licence key as secrets', () => {
    const secret = bluedartFactory.fields.filter((f) => f.secret).map((f) => f.key)
    expect(secret.sort()).toEqual(['clientSecret', 'licenceKey'])
  })

  it('validates and normalises the config', () => {
    const v = bluedartFactory.validateConfig({
      ...raw,
      surfaceMode: 'true',
      registerPickup: 'false',
    })
    expect(v.ok && v.config).toMatchObject({
      originArea: 'DEL',
      productCode: 'E',
      registerPickup: false,
    })
    const d = bluedartFactory.validateConfig(raw)
    expect(d.ok && d.config).toMatchObject({ productCode: 'A', registerPickup: true })
  })

  it('refuses a bad area code and a base URL off Blue Dart’s domain', () => {
    const v = bluedartFactory.validateConfig({
      ...raw,
      originArea: 'DELHI',
      baseUrl: 'https://evil.example',
    })
    expect(v.ok).toBe(false)
    if (!v.ok) {
      expect(v.errors.join()).toMatch(/area code/)
      expect(v.errors.join()).toMatch(/bluedart\.com/)
    }
  })
})

describeShippingProvider('bluedart (offline)', {
  create: () =>
    new BluedartProvider({
      ...config(),
      fetchImpl: async () => {
        throw new TypeError('offline')
      },
    }),
})
