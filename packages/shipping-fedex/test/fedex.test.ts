import { CourierError, type CreateShipmentInput } from '@commerce/shipping'
import { describeShippingProvider } from '@commerce/shipping/testing'
import { beforeEach, describe, expect, it } from 'vitest'
import { FEDEX_LIVE_URL, FEDEX_TEST_URL } from '../src/client'
import { clearFedexTokens, FedexProvider, fedexFactory, mapFedexStatus } from '../src/fedex'

type Route = (url: URL, init?: RequestInit) => Response | Promise<Response>

/** A fetch that records every call and answers from a route table keyed "METHOD /path". */
function fakeFetch(routes: Record<string, Route>) {
  const calls: { url: URL; init?: RequestInit | undefined }[] = []
  const impl: typeof fetch = async (input, init) => {
    const url = new URL(
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
    )
    calls.push({ url, init })
    const method = init?.method ?? 'GET'
    const route = Object.entries(routes).find(([key]) => {
      const [m, path] = key.split(' ')
      return m === method && url.pathname === path
    })?.[1]
    if (!route) return new Response('not found', { status: 404 })
    return route(url, init)
  }
  const of = (path: string) => calls.filter((c) => c.url.pathname === path)
  return { impl, calls, of }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

const bodyOf = (init?: RequestInit) => JSON.parse((init?.body as string) ?? '{}')

const token = () => json({ access_token: 'tok-1', token_type: 'bearer', expires_in: 3599 })

const NOW = new Date('2026-10-20T06:30:00Z') // 12:00 in India

const config = {
  clientId: 'fx-key',
  clientSecret: 'fx-secret',
  accountNumber: '740561073',
  originPincode: '131028',
  originCity: 'Sonipat',
  iec: 'ABCDE1234F',
  mode: 'test' as const,
  bookPickup: true,
  now: () => NOW,
}

const exportShipment: CreateShipmentInput = {
  orderId: 'order-1',
  orderNumber: 1042,
  to: {
    name: 'Jane Doe',
    line1: '116 Marine Dr',
    city: 'Graford',
    state: 'TX',
    pincode: '76449',
    country: 'US',
    phone: '+1 (940) 282-5665',
  },
  from: {
    name: 'Waimers',
    line1: 'Plot 4, HSIIDC',
    city: 'Sonipat',
    state: 'HR',
    pincode: '131028',
    country: 'IN',
    phone: '99999 99998',
  },
  lines: [
    {
      title: 'Maboroshi mousepad',
      quantity: 2,
      unitPricePaise: 199900,
      hsCode: '39269099',
      unitWeightGrams: 400,
    },
  ],
  paymentMode: 'prepaid',
  codAmountPaise: 0,
  valuePaise: 399800,
  weightGrams: 800,
  exporterGstin: '06ABCDE1234F1Z5',
}

const rateAnswer = {
  output: {
    rateReplyDetails: [
      {
        serviceType: 'FEDEX_INTERNATIONAL_PRIORITY',
        serviceName: 'FedEx International PriorityÂ®',
        ratedShipmentDetails: [
          { rateType: 'ACCOUNT', currency: 'USD', totalNetCharge: 60 },
          {
            rateType: 'PREFERRED_ACCOUNT_SHIPMENT',
            currency: 'INR',
            totalNetCharge: 5120.4,
            totalBaseCharge: 4500,
            totalVatCharge: 0,
            shipmentRateDetail: {
              totalFreightDiscount: 200,
              surCharges: [
                { type: 'FUEL', amount: 820.4 },
                { type: 'DEMAND', amount: 0 },
              ],
              totalBillingWeight: { units: 'KG', value: 1 },
            },
          },
        ],
        operationalDetail: { transitTime: 'THREE_DAYS' },
      },
      {
        serviceType: 'INTERNATIONAL_ECONOMY',
        serviceName: 'FedEx International Economy',
        ratedShipmentDetails: [{ rateType: 'ACCOUNT', currency: 'USD', totalNetCharge: 40 }],
      },
    ],
  },
}

beforeEach(() => clearFedexTokens())

describeShippingProvider('fedex', {
  create: () =>
    new FedexProvider({ ...config, fetchImpl: fakeFetch({ 'POST /oauth/token': token }).impl }),
})

describe('FedexProvider OAuth', () => {
  it('gets a client-credentials token from the sandbox host, and reuses it', async () => {
    const f = fakeFetch({
      'POST /oauth/token': token,
      'POST /rate/v1/rates/quotes': () => json(rateAnswer),
    })
    const p = new FedexProvider({ ...config, fetchImpl: f.impl })
    const q = {
      originPincode: '131028',
      destinationPincode: '76449',
      destinationCountry: 'US',
      destinationCity: 'Graford',
      weightGrams: 800,
      declaredValuePaise: 399800,
      paymentMode: 'prepaid' as const,
    }
    await p.quoteOptions(q)
    await p.quoteOptions(q)
    const grants = f.of('/oauth/token')
    expect(grants).toHaveLength(1)
    expect(grants[0]?.url.origin).toBe(FEDEX_TEST_URL)
    expect(new URLSearchParams(grants[0]?.init?.body as string).get('grant_type')).toBe(
      'client_credentials',
    )
    const rate = f.of('/rate/v1/rates/quotes')[0]
    const headers = (rate?.init?.headers ?? {}) as Record<string, string>
    expect(headers.Authorization).toBe('Bearer tok-1')
  })

  it('uses the live host in live mode', async () => {
    const f = fakeFetch({ 'POST /oauth/token': token })
    const r = await new FedexProvider({
      ...config,
      mode: 'live',
      fetchImpl: f.impl,
    }).verifyCredentials()
    expect(r.ok).toBe(true)
    expect(f.calls[0]?.url.origin).toBe(FEDEX_LIVE_URL)
  })

  it('answers a refused key with an actionable message', async () => {
    const f = fakeFetch({
      'POST /oauth/token': () => json({ errors: [{ code: 'NOT.AUTHORIZED.ERROR' }] }, 401),
    })
    const r = await new FedexProvider({ ...config, fetchImpl: f.impl }).verifyCredentials()
    expect(r.ok).toBe(false)
    expect(r.message).toMatch(/developer\.fedex\.com/)
  })
})

describe('FedexProvider rates', () => {
  it('says no to an Indian PIN code without calling FedEx', async () => {
    const f = fakeFetch({})
    const r = await new FedexProvider({ ...config, fetchImpl: f.impl }).checkServiceability({
      originPincode: '131028',
      destinationPincode: '560001',
    })
    expect(r.serviceable).toBe(false)
    expect(f.calls).toHaveLength(0)
  })

  it('lists services priced in rupees with transit days and charges, dropping other currencies', async () => {
    const f = fakeFetch({
      'POST /oauth/token': token,
      'POST /rate/v1/rates/quotes': () => json(rateAnswer),
    })
    const options = await new FedexProvider({ ...config, fetchImpl: f.impl }).quoteOptions({
      originPincode: '131028',
      destinationPincode: '76449',
      destinationCountry: 'us',
      destinationCity: 'Graford',
      weightGrams: 800,
      declaredValuePaise: 399800,
      paymentMode: 'prepaid',
    })
    expect(options).toEqual([
      {
        serviceId: 'FEDEX_INTERNATIONAL_PRIORITY',
        serviceLabel: 'International Priority',
        carrier: null,
        pricePaise: 512040,
        minTransitDays: 3,
        maxTransitDays: 3,
        codAvailable: false,
        charges: [
          { kind: 'freight', pricePaise: 430000 },
          { kind: 'fuel', pricePaise: 82040 },
        ],
        chargeableWeightGrams: 1000,
      },
    ])
    const body = bodyOf(f.of('/rate/v1/rates/quotes')[0]?.init)
    expect(body.accountNumber).toEqual({ value: '740561073' })
    expect(body.requestedShipment).toMatchObject({
      shipper: { address: { postalCode: '131028', city: 'Sonipat', countryCode: 'IN' } },
      recipient: { address: { postalCode: '76449', city: 'Graford', countryCode: 'US' } },
      preferredCurrency: 'INR',
      shipDateStamp: '2026-10-20',
      pickupType: 'CONTACT_FEDEX_TO_SCHEDULE',
      requestedPackageLineItems: [{ weight: { units: 'KG', value: 0.8 } }],
    })
    expect(body.rateRequestControlParameters).toEqual({ returnTransitTimes: true })
  })

  it('turns FedEx errors into a rejected CourierError with FedEx’s words', async () => {
    const f = fakeFetch({
      'POST /oauth/token': token,
      'POST /rate/v1/rates/quotes': () =>
        json(
          { errors: [{ code: 'RECIPIENT.POSTALCODE.INVALID', message: 'Invalid postal code.' }] },
          400,
        ),
    })
    const err = await new FedexProvider({ ...config, fetchImpl: f.impl })
      .quoteOptions({
        originPincode: '131028',
        destinationPincode: 'X',
        destinationCountry: 'US',
        weightGrams: 500,
        declaredValuePaise: 1,
        paymentMode: 'prepaid',
      })
      .catch((e) => e)
    expect(err).toBeInstanceOf(CourierError)
    expect(err.kind).toBe('rejected')
    expect(err.message).toBe('FedEx: Invalid postal code.')
  })
})

describe('FedexProvider shipments', () => {
  const shipAnswer = {
    output: {
      transactionShipments: [
        {
          masterTrackingNumber: '794953535000',
          pieceResponses: [
            {
              trackingNumber: '794953535000',
              packageDocuments: [
                { contentType: 'LABEL', docType: 'PDF', encodedLabel: 'JVBERi0xLjQK' },
              ],
            },
          ],
          shipmentDocuments: [
            { contentType: 'COMMERCIAL_INVOICE', docType: 'PDF', encodedLabel: 'JVBERi0xLjQKaW52' },
          ],
          completedShipmentDetail: {
            shipmentRating: { shipmentRateDetails: [{ currency: 'INR', totalNetCharge: 5120.4 }] },
          },
        },
      ],
    },
  }

  it('books with commodities, GSTIN and IEC, returns label and invoice, and requests a pickup', async () => {
    const f = fakeFetch({
      'POST /oauth/token': token,
      'POST /ship/v1/shipments': () => json(shipAnswer),
      'POST /pickup/v1/pickups': () => json({ output: { pickupConfirmationCode: '3001' } }),
    })
    const r = await new FedexProvider({ ...config, fetchImpl: f.impl }).createShipment({
      ...exportShipment,
      serviceId: 'FEDEX_INTERNATIONAL_PRIORITY',
    })
    expect(r).toEqual({
      waybill: '794953535000',
      providerRef: '794953535000',
      documents: [
        { kind: 'label', pdfBase64: 'JVBERi0xLjQK' },
        { kind: 'commercial_invoice', pdfBase64: 'JVBERi0xLjQKaW52' },
      ],
      chargePaise: 512040,
    })
    const ship = bodyOf(f.of('/ship/v1/shipments')[0]?.init)
    expect(ship.labelResponseOptions).toBe('LABEL')
    const rs = ship.requestedShipment
    expect(rs.serviceType).toBe('FEDEX_INTERNATIONAL_PRIORITY')
    expect(rs.shipper.tins).toEqual([{ number: '06ABCDE1234F1Z5', tinType: 'BUSINESS_NATIONAL' }])
    expect(rs.shipper.contact.phoneNumber).toBe('9999999998')
    expect(rs.recipients[0].address).toMatchObject({
      postalCode: '76449',
      countryCode: 'US',
      stateOrProvinceCode: 'TX',
    })
    expect(rs.customsClearanceDetail.commercialInvoice).toMatchObject({
      shipmentPurpose: 'SOLD',
      termsOfSale: 'DAP',
      specialInstructions: 'IEC: ABCDE1234F',
    })
    expect(rs.customsClearanceDetail.commodities).toEqual([
      {
        description: 'Maboroshi mousepad',
        countryOfManufacture: 'IN',
        harmonizedCode: '39269099',
        quantity: 2,
        quantityUnits: 'PCS',
        unitPrice: { amount: 1999, currency: 'INR' },
        customsValue: { amount: 3998, currency: 'INR' },
        weight: { units: 'KG', value: 0.8 },
      },
    ])
    expect(rs.shippingDocumentSpecification.shippingDocumentTypes).toEqual(['COMMERCIAL_INVOICE'])
    const pickup = bodyOf(f.of('/pickup/v1/pickups')[0]?.init)
    expect(pickup).toMatchObject({
      associatedAccountNumber: { value: '740561073' },
      carrierCode: 'FDXE',
      countryRelationships: 'INTERNATIONAL',
      trackingNumber: '794953535000',
      originDetail: { pickupDateType: 'SAME_DAY', readyDateTimestamp: '2026-10-20T07:00:00Z' },
    })
  })

  it('keeps the booking when the pickup request fails', async () => {
    const f = fakeFetch({
      'POST /oauth/token': token,
      'POST /ship/v1/shipments': () => json(shipAnswer),
      'POST /pickup/v1/pickups': () => json({ errors: [{ message: 'No pickup today' }] }, 400),
    })
    const r = await new FedexProvider({ ...config, fetchImpl: f.impl }).createShipment(
      exportShipment,
    )
    expect(r.waybill).toBe('794953535000')
  })

  it('refuses a line without an HS code before calling FedEx', async () => {
    const f = fakeFetch({ 'POST /oauth/token': token })
    const err = await new FedexProvider({ ...config, fetchImpl: f.impl })
      .createShipment({
        ...exportShipment,
        lines: [{ title: 'Desk mat', quantity: 1, unitPricePaise: 1 }],
      })
      .catch((e) => e)
    expect(err.message).toMatch(/HS code.*Desk mat/)
    expect(f.of('/ship/v1/shipments')).toHaveLength(0)
  })

  it('cancels by tracking number and reports a refusal', async () => {
    const ok = fakeFetch({
      'POST /oauth/token': token,
      'PUT /ship/v1/shipments/cancel': () => json({ output: { cancelledShipment: true } }),
    })
    await new FedexProvider({ ...config, fetchImpl: ok.impl }).cancel('794953535000')
    expect(bodyOf(ok.of('/ship/v1/shipments/cancel')[0]?.init)).toMatchObject({
      trackingNumber: '794953535000',
      deletionControl: 'DELETE_ALL_PACKAGES',
    })
    clearFedexTokens()
    const no = fakeFetch({
      'POST /oauth/token': token,
      'PUT /ship/v1/shipments/cancel': () => json({ output: { cancelledShipment: false } }),
    })
    await expect(
      new FedexProvider({ ...config, fetchImpl: no.impl }).cancel('794953535000'),
    ).rejects.toThrow(/did not cancel/)
  })
})

describe('FedexProvider tracking', () => {
  it('maps scans oldest first and takes the latest status and estimated date', async () => {
    const f = fakeFetch({
      'POST /oauth/token': token,
      'POST /track/v1/trackingnumbers': () =>
        json({
          output: {
            completeTrackResults: [
              {
                trackResults: [
                  {
                    latestStatusDetail: { code: 'IT', derivedCode: 'IT' },
                    dateAndTimes: [
                      { type: 'ESTIMATED_DELIVERY', dateTime: '2026-10-24T18:00:00-05:00' },
                    ],
                    scanEvents: [
                      {
                        date: '2026-10-21T09:00:00-05:00',
                        eventType: 'AR',
                        derivedStatusCode: 'IT',
                        eventDescription: 'Arrived at FedEx location',
                        scanLocation: { city: 'MEMPHIS', countryCode: 'US' },
                      },
                      {
                        date: '2026-10-20T18:00:00+05:30',
                        eventType: 'PU',
                        derivedStatusCode: 'PU',
                        eventDescription: 'Picked up',
                      },
                    ],
                  },
                ],
              },
            ],
          },
        }),
    })
    const t = await new FedexProvider({ ...config, fetchImpl: f.impl }).track('794953535000')
    expect(t.status).toBe('in_transit')
    expect(t.expectedDate).toBe('2026-10-24')
    expect(t.events.map((e) => e.status)).toEqual(['picked_up', 'in_transit'])
    expect(t.events[1]?.location).toBe('MEMPHIS, US')
  })

  it('maps the status codes', () => {
    expect(mapFedexStatus('DL')).toBe('delivered')
    expect(mapFedexStatus('OD')).toBe('out_for_delivery')
    expect(mapFedexStatus('RS')).toBe('rto')
    expect(mapFedexStatus('DE')).toBe('in_transit')
  })
})

describe('fedexFactory', () => {
  it('validates fields and defaults to test mode with pickups on', () => {
    expect(fedexFactory.validateConfig({ clientId: 'a' }).ok).toBe(false)
    expect(
      fedexFactory.validateConfig({
        clientId: 'a',
        clientSecret: 'b',
        accountNumber: '740561073',
        originPincode: '131028',
        originCity: 'Sonipat',
        bookPickup: 'false',
      }),
    ).toMatchObject({ ok: true, config: { mode: 'test', bookPickup: false } })
  })
})

describe('FedEx for tracking only', () => {
  const trackingOnly = { ...config, accountNumber: '', originPincode: '', originCity: '' }

  it('accepts just the key and secret, but not half an origin', () => {
    expect(fedexFactory.validateConfig({ clientId: 'a', clientSecret: 'b' })).toMatchObject({
      ok: true,
      config: { accountNumber: '', originPincode: '', originCity: '' },
    })
    expect(
      fedexFactory.validateConfig({ clientId: 'a', clientSecret: 'b', originPincode: '131028' }),
    ).toMatchObject({ ok: false })
  })

  it('quotes nothing and refuses to book, without calling FedEx', async () => {
    const f = fakeFetch({ 'POST /oauth/token': token })
    const p = new FedexProvider({ ...trackingOnly, fetchImpl: f.impl })
    const query = {
      originPincode: '131028',
      destinationPincode: '10001',
      destinationCountry: 'US',
      weightGrams: 500,
      declaredValuePaise: 100000,
      paymentMode: 'prepaid' as const,
    }
    expect(await p.quoteOptions(query)).toEqual([])
    expect(await p.quoteRate(query)).toBeNull()
    await expect(p.createShipment(exportShipment)).rejects.toThrow(/tracking only/)
    expect(f.calls).toHaveLength(0)
  })
})
