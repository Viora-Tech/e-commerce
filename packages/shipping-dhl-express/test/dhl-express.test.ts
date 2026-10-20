import { CourierError, type CreateShipmentInput } from '@commerce/shipping'
import { describeShippingProvider } from '@commerce/shipping/testing'
import { describe, expect, it } from 'vitest'
import { DHL_EXPRESS_LIVE_URL, DHL_EXPRESS_TEST_URL } from '../src/client'
import { DhlExpressProvider, dhlExpressFactory, mapDhlEvent } from '../src/dhl-express'

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
      return m === method && url.pathname.endsWith(path as string)
    })?.[1]
    if (!route) return new Response('not found', { status: 404 })
    return route(url, init)
  }
  return { impl, calls }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

const bodyOf = (init?: RequestInit) => JSON.parse((init?.body as string) ?? '{}')

const NOW = new Date('2026-10-20T06:30:00Z') // 12:00 in India

const config = {
  apiKey: 'dhl-key',
  apiSecret: 'dhl-secret',
  accountNumber: '123456789',
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
    phone: '+19402825665',
  },
  from: {
    name: 'Waimers',
    line1: 'Plot 4, HSIIDC Industrial Estate, Kundli, near the toll plaza on NH 44',
    city: 'Sonipat',
    state: 'HR',
    pincode: '131028',
    country: 'IN',
    phone: '9999999998',
  },
  lines: [
    {
      title: 'Maboroshi mousepad',
      quantity: 2,
      unitPricePaise: 199900,
      hsCode: '3926.90.99',
      unitWeightGrams: 300,
    },
    {
      title: 'Desk mat',
      quantity: 1,
      unitPricePaise: 99900,
      hsCode: '39269099',
      countryOfOrigin: 'cn',
    },
  ],
  paymentMode: 'prepaid',
  codAmountPaise: 0,
  valuePaise: 499700,
  weightGrams: 1000,
  exporterGstin: '06ABCDE1234F1Z5',
}

const ratesAnswer = {
  products: [
    {
      productName: 'EXPRESS WORLDWIDE NONDOC',
      productCode: 'P',
      weight: { volumetric: 1.2, provided: 1 },
      totalPrice: [
        { currencyType: 'BILLC', priceCurrency: 'INR', price: 4210.5 },
        { currencyType: 'BASEC', priceCurrency: 'EUR', price: 46.1 },
      ],
      totalPriceBreakdown: [
        {
          currencyType: 'BILLC',
          priceCurrency: 'INR',
          priceBreakdown: [{ typeCode: 'STTXA', price: 642.28 }],
        },
      ],
      detailedPriceBreakdown: [
        {
          currencyType: 'BILLC',
          priceCurrency: 'INR',
          breakdown: [
            { name: 'EXPRESS WORLDWIDE', price: 3000 },
            { name: 'FUEL SURCHARGE', serviceCode: 'FF', price: 568.22 },
            { name: 'SATURDAY DELIVERY', serviceCode: 'AA' },
          ],
        },
      ],
      deliveryCapabilities: { totalTransitDays: 4 },
    },
    {
      productName: 'EXPRESS 12:00',
      productCode: 'Y',
      totalPrice: [{ currencyType: 'BILLC', priceCurrency: 'USD', price: 90 }],
      deliveryCapabilities: { totalTransitDays: 3 },
    },
  ],
}

describeShippingProvider('dhl-express', {
  create: () =>
    new DhlExpressProvider({
      ...config,
      fetchImpl: fakeFetch({ 'GET /address-validate': () => json({ address: [] }) }).impl,
    }),
})

describe('DhlExpressProvider hosts and auth', () => {
  it('uses the sandbox in test mode and the live host in live mode, with Basic auth', async () => {
    const f = fakeFetch({
      'GET /address-validate': () => json({ address: [{ cityName: 'SONIPAT' }] }),
    })
    const test = await new DhlExpressProvider({ ...config, fetchImpl: f.impl }).verifyCredentials()
    await new DhlExpressProvider({ ...config, mode: 'live', fetchImpl: f.impl }).verifyCredentials()
    expect(test.ok).toBe(true)
    expect(f.calls[0]?.url.href.startsWith(DHL_EXPRESS_TEST_URL)).toBe(true)
    expect(f.calls[1]?.url.href.startsWith(`${DHL_EXPRESS_LIVE_URL}/address-validate`)).toBe(true)
    const headers = f.calls[0]?.init?.headers as Record<string, string>
    expect(headers.Authorization).toBe(
      `Basic ${Buffer.from('dhl-key:dhl-secret').toString('base64')}`,
    )
    expect(f.calls[0]?.url.searchParams.get('postalCode')).toBe('131028')
  })

  it('answers bad keys with an actionable message instead of throwing', async () => {
    const f = fakeFetch({ 'GET /address-validate': () => new Response('', { status: 401 }) })
    const r = await new DhlExpressProvider({ ...config, fetchImpl: f.impl }).verifyCredentials()
    expect(r.ok).toBe(false)
    expect(r.message).toMatch(/developer\.dhl\.com/)
  })
})

describe('DhlExpressProvider rates', () => {
  it('says no to an Indian PIN code without calling DHL', async () => {
    const f = fakeFetch({})
    const p = new DhlExpressProvider({ ...config, fetchImpl: f.impl })
    const r = await p.checkServiceability({ originPincode: '131028', destinationPincode: '560001' })
    expect(r.serviceable).toBe(false)
    expect(
      await p.quoteOptions({
        originPincode: '131028',
        destinationPincode: '560001',
        weightGrams: 500,
        declaredValuePaise: 1,
        paymentMode: 'prepaid',
      }),
    ).toEqual([])
    expect(f.calls).toHaveLength(0)
  })

  it('lists each product priced in rupees, with itemised charges, and drops non-INR prices', async () => {
    const f = fakeFetch({ 'POST /rates': () => json(ratesAnswer) })
    const p = new DhlExpressProvider({ ...config, fetchImpl: f.impl })
    const options = await p.quoteOptions({
      originPincode: '131028',
      destinationPincode: '76449',
      destinationCountry: 'US',
      destinationCity: 'Graford',
      weightGrams: 1000,
      declaredValuePaise: 499700,
      paymentMode: 'prepaid',
      dimensionsCm: { length: 30, width: 20, height: 5 },
    })
    expect(options).toEqual([
      {
        serviceId: 'P',
        serviceLabel: 'Express Worldwide',
        carrier: null,
        pricePaise: 421050,
        minTransitDays: 4,
        maxTransitDays: 4,
        codAvailable: false,
        charges: [
          { kind: 'freight', pricePaise: 300000 },
          { kind: 'fuel', pricePaise: 56822 },
          { kind: 'gst', pricePaise: 64228 },
        ],
        chargeableWeightGrams: 1200,
      },
    ])
    const body = bodyOf(f.calls[0]?.init)
    expect(body.customerDetails).toEqual({
      shipperDetails: { postalCode: '131028', cityName: 'Sonipat', countryCode: 'IN' },
      receiverDetails: { postalCode: '76449', cityName: 'Graford', countryCode: 'US' },
    })
    expect(body.accounts).toEqual([{ typeCode: 'shipper', number: '123456789' }])
    expect(body.plannedShippingDateAndTime).toBe('2026-10-20T13:00:00 GMT+05:30')
    expect(body.monetaryAmount).toEqual([
      { typeCode: 'declaredValue', value: 4997, currency: 'INR' },
    ])
    expect(body.packages).toEqual([{ weight: 1, dimensions: { length: 30, width: 20, height: 5 } }])
  })

  it('reports serviceability abroad from the products DHL offers', async () => {
    const f = fakeFetch({ 'POST /rates': () => json(ratesAnswer) })
    const r = await new DhlExpressProvider({ ...config, fetchImpl: f.impl }).checkServiceability({
      originPincode: '131028',
      destinationPincode: '76449',
      destinationCountry: 'US',
      destinationCity: 'Graford',
    })
    expect(r).toMatchObject({
      serviceable: true,
      codAvailable: false,
      minTransitDays: 3,
      maxTransitDays: 4,
    })
  })

  it('turns a DHL refusal into a rejected CourierError carrying DHL’s reason', async () => {
    const f = fakeFetch({
      'POST /rates': () =>
        json({ title: 'Bad request', detail: '420504: The postal code is invalid.' }, 400),
    })
    const p = new DhlExpressProvider({ ...config, fetchImpl: f.impl })
    const err = await p
      .quoteOptions({
        originPincode: '131028',
        destinationPincode: 'X',
        destinationCountry: 'US',
        destinationCity: 'Graford',
        weightGrams: 500,
        declaredValuePaise: 100,
        paymentMode: 'prepaid',
      })
      .catch((e) => e)
    expect(err).toBeInstanceOf(CourierError)
    expect(err.kind).toBe('rejected')
    expect(err.message).toBe('DHL Express: 420504: The postal code is invalid.')
  })
})

describe('DhlExpressProvider shipments', () => {
  it('books with customs lines, GSTIN, IEC and a pickup, and hands back the PDFs', async () => {
    const f = fakeFetch({
      'POST /shipments': () =>
        json({
          shipmentTrackingNumber: '1103733901',
          dispatchConfirmationNumber: 'DEL201020123456',
          documents: [
            { imageFormat: 'PDF', content: 'JVBERi0xLjQK', typeCode: 'label' },
            { imageFormat: 'PDF', content: 'JVBERi0xLjQKaW52', typeCode: 'invoice' },
          ],
          shipmentCharges: [{ currencyType: 'BILLC', priceCurrency: 'INR', price: 4210.5 }],
        }),
    })
    const p = new DhlExpressProvider({ ...config, fetchImpl: f.impl })
    const r = await p.createShipment({ ...exportShipment, serviceId: 'P' })
    expect(r).toEqual({
      waybill: '1103733901',
      providerRef: 'DEL201020123456',
      documents: [
        { kind: 'label', pdfBase64: 'JVBERi0xLjQK' },
        { kind: 'commercial_invoice', pdfBase64: 'JVBERi0xLjQKaW52' },
      ],
      chargePaise: 421050,
    })
    const body = bodyOf(f.calls[0]?.init)
    expect(body.productCode).toBe('P')
    expect(body.pickup).toEqual({ isRequested: true })
    expect(body.customerDetails.shipperDetails.registrationNumbers).toEqual([
      { typeCode: 'VAT', number: '06ABCDE1234F1Z5', issuerCountryCode: 'IN' },
    ])
    // A 70-character street line spills over DHL's 45-character limit into line 2.
    const shipper = body.customerDetails.shipperDetails.postalAddress
    expect(shipper.addressLine1.length).toBeLessThanOrEqual(45)
    expect(shipper.addressLine2).toBeTruthy()
    expect(body.customerDetails.receiverDetails.postalAddress).toMatchObject({
      postalCode: '76449',
      cityName: 'Graford',
      countryCode: 'US',
      provinceCode: 'TX',
    })
    const declaration = body.content.exportDeclaration
    expect(declaration.exporter).toEqual({ id: 'ABCDE1234F' })
    expect(declaration.invoice).toEqual({ number: '1042', date: '2026-10-20' })
    expect(declaration.lineItems).toEqual([
      expect.objectContaining({
        number: 1,
        price: 1999,
        quantity: { value: 2, unitOfMeasurement: 'PCS' },
        commodityCodes: [{ typeCode: 'outbound', value: '39269099' }],
        manufacturerCountry: 'IN',
        weight: { netValue: 0.6, grossValue: 0.6 },
      }),
      // No weight of its own: it gets what is left of the 1 kg parcel.
      expect.objectContaining({
        manufacturerCountry: 'CN',
        weight: { netValue: 0.4, grossValue: 0.4 },
      }),
    ])
    expect(body.content).toMatchObject({
      declaredValue: 4997,
      declaredValueCurrency: 'INR',
      incoterm: 'DAP',
    })
  })

  it('refuses to book without an HS code on every line, naming the item', async () => {
    const f = fakeFetch({})
    const p = new DhlExpressProvider({ ...config, fetchImpl: f.impl })
    const err = await p
      .createShipment({
        ...exportShipment,
        lines: [{ title: 'Desk mat', quantity: 1, unitPricePaise: 99900 }],
      })
      .catch((e) => e)
    expect(err).toBeInstanceOf(CourierError)
    expect(err.message).toMatch(/HS code.*Desk mat/)
    expect(f.calls).toHaveLength(0)
  })

  it('refuses a domestic or COD order before calling DHL', async () => {
    const p = new DhlExpressProvider({ ...config, fetchImpl: fakeFetch({}).impl })
    await expect(
      p.createShipment({ ...exportShipment, to: { ...exportShipment.to, country: 'IN' } }),
    ).rejects.toThrow(/other countries only/)
    await expect(p.createShipment({ ...exportShipment, paymentMode: 'cod' })).rejects.toThrow(
      /cash on delivery/,
    )
  })

  it('cancels the booked pickup by its dispatch number, and does nothing for a bare waybill', async () => {
    const f = fakeFetch({
      'DELETE /pickups/DEL201020123456': () => new Response(null, { status: 200 }),
    })
    const p = new DhlExpressProvider({ ...config, fetchImpl: f.impl })
    await p.cancel('DEL201020123456')
    await p.cancel('1103733901')
    expect(f.calls).toHaveLength(1)
    expect(f.calls[0]?.url.searchParams.get('requestorName')).toBeTruthy()
    expect(f.calls[0]?.url.searchParams.get('reason')).toBeTruthy()
  })
})

describe('DhlExpressProvider tracking', () => {
  it('maps checkpoints to statuses, oldest first, with DHL’s offset', async () => {
    const f = fakeFetch({
      'GET /shipments/1103733901/tracking': () =>
        json({
          shipments: [
            {
              shipmentTrackingNumber: '1103733901',
              estimatedDeliveryDate: '2026-10-24',
              events: [
                {
                  date: '2026-10-23',
                  time: '10:50:14',
                  GMTOffset: '-05:00',
                  typeCode: 'WC',
                  description: 'With courier',
                },
                {
                  date: '2026-10-20',
                  time: '18:00:00',
                  GMTOffset: '+05:30',
                  typeCode: 'PU',
                  description: 'Picked up',
                  serviceArea: [{ code: 'DEL', description: 'NEW DELHI-IN' }],
                },
              ],
            },
          ],
        }),
    })
    const t = await new DhlExpressProvider({ ...config, fetchImpl: f.impl }).track('1103733901')
    expect(t.status).toBe('out_for_delivery')
    expect(t.expectedDate).toBe('2026-10-24')
    expect(t.events.map((e) => e.status)).toEqual(['picked_up', 'out_for_delivery'])
    expect(t.events[0]).toMatchObject({ at: '2026-10-20T12:30:00.000Z', location: 'NEW DELHI-IN' })
    expect(t.events[1]?.at).toBe('2026-10-23T15:50:14.000Z')
    expect(t.trackingUrl).toContain('1103733901')
  })

  it('maps the checkpoint codes', () => {
    expect(mapDhlEvent('OK')).toBe('delivered')
    expect(mapDhlEvent('RT')).toBe('rto')
    expect(mapDhlEvent('AF')).toBe('in_transit')
    expect(mapDhlEvent(undefined)).toBe('in_transit')
  })
})

describe('dhlExpressFactory', () => {
  it('validates the account fields and defaults to test mode with a pickup per shipment', () => {
    const bad = dhlExpressFactory.validateConfig({
      apiKey: 'k',
      apiSecret: 's',
      accountNumber: 'abc',
      originPincode: '12',
      iec: 'short',
    })
    expect(bad.ok).toBe(false)
    const good = dhlExpressFactory.validateConfig({
      apiKey: 'k',
      apiSecret: 's',
      accountNumber: '123456789',
      originPincode: '131028',
      originCity: 'Sonipat',
      iec: 'abcde1234f',
    })
    expect(good).toMatchObject({
      ok: true,
      config: { mode: 'test', bookPickup: true, iec: 'ABCDE1234F' },
    })
  })

  it('marks the API secret as a secret field', () => {
    expect(dhlExpressFactory.fields.find((f) => f.key === 'apiSecret')?.secret).toBe(true)
  })
})
