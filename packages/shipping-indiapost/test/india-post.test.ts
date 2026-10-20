import { CourierError, decodePincodeDirectory } from '@commerce/shipping'
import { describeShippingProvider, sampleShipment } from '@commerce/shipping/testing'
import { describe, expect, it, vi } from 'vitest'
import {
  decodeLabelRef,
  encodeLabelRef,
  IndiaPostProvider,
  indiaPostFactory,
  mapIndiaPostStatus,
  SPEED_POST_REGISTERED,
} from '../src/india-post'
import { PINCODE_API_URL } from '../src/pin-directory'

/** data.gov.in's answer for a PIN code, shaped like the live API (verified 2026-10-20). */
const API: Record<string, Array<Record<string, string>>> = {
  '131028': [
    {
      officename: 'Kundli S.O',
      officetype: 'PO',
      delivery: 'Delivery',
      district: 'SONIPAT',
      statename: 'HARYANA',
    },
    {
      officename: 'Nathupur B.O',
      officetype: 'BO',
      delivery: 'Delivery',
      district: 'SONIPAT',
      statename: 'HARYANA',
    },
  ],
  '110001': [
    {
      officename: 'Patiala House SO',
      officetype: 'PO',
      delivery: 'Non Delivery',
      district: 'NEW DELHI',
      statename: 'DELHI',
    },
    {
      officename: 'New Delhi GPO',
      officetype: 'HO',
      delivery: 'Delivery',
      district: 'NEW DELHI',
      statename: 'DELHI',
    },
  ],
  '122001': [
    {
      officename: 'Gurgaon H.O',
      officetype: 'HO',
      delivery: 'Delivery',
      district: 'GURUGRAM',
      statename: 'HARYANA',
    },
  ],
  '781001': [
    {
      officename: 'Guwahati G.P.O.',
      officetype: 'HO',
      delivery: 'Delivery',
      district: 'KAMRUP METRO',
      statename: 'ASSAM',
    },
  ],
}

function mockApi(opts: { status?: number } = {}) {
  return vi.fn(async (url: string | URL | Request) => {
    const u = new URL(String(url))
    expect(`${u.origin}${u.pathname}`).toBe(PINCODE_API_URL)
    expect(u.searchParams.get('api-key')).toBe('test-key')
    if (opts.status) {
      return new Response(JSON.stringify({ error: 'Key not authorised' }), { status: opts.status })
    }
    const records = API[u.searchParams.get('filters[pincode]') ?? ''] ?? []
    return Response.json({ status: 'ok', total: records.length, count: records.length, records })
  })
}

const config = (more: Record<string, string> = {}) => {
  const v = indiaPostFactory.validateConfig({ originPincode: '131028', ...more })
  if (!v.ok) throw new Error(v.errors.join(', '))
  return v.config
}

const noDirectory = async () => null

describeShippingProvider('india-post', {
  create: () => new IndiaPostProvider(config(), { loadDirectory: noDirectory }),
})

describe('India Post config', () => {
  it('needs only an origin PIN code, and explains bad values', () => {
    expect(indiaPostFactory.validateConfig({ originPincode: '131028' }).ok).toBe(true)
    const bad = indiaPostFactory.validateConfig({
      originPincode: '12',
      codFeeRupees: 'ten',
      tariffOverride: '{',
    })
    expect(bad).toEqual({
      ok: false,
      errors: [
        'origin PIN code must be 6 digits',
        'COD fee must be a number of rupees',
        'your own rates are not valid JSON',
      ],
    })
  })

  it('flags the data.gov.in key as a secret', () => {
    expect(indiaPostFactory.fields.find((f) => f.key === 'dataGovApiKey')?.secret).toBe(true)
  })
})

describe('serviceability from the PIN code directory', () => {
  it('asks data.gov.in with the merchant key and shows the delivery office first', async () => {
    const fetchImpl = mockApi()
    const p = new IndiaPostProvider(config({ dataGovApiKey: 'test-key' }), {
      fetchImpl,
      loadDirectory: noDirectory,
    })
    expect(await p.place('110001')).toEqual({
      pincode: '110001',
      offices: ['New Delhi GPO', 'Patiala House SO'],
      district: 'New Delhi',
      state: 'DELHI',
      source: 'data.gov.in',
    })
    // Cached: a second ask does not call again.
    await p.place('110001')
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it('says not serviceable for a PIN code the directory does not know', async () => {
    const p = new IndiaPostProvider(config({ dataGovApiKey: 'test-key' }), {
      fetchImpl: mockApi(),
      loadDirectory: noDirectory,
    })
    const r = await p.checkServiceability({ originPincode: '131028', destinationPincode: '999999' })
    expect(r).toMatchObject({
      serviceable: false,
      reason: 'PIN code not in the India Post directory',
    })
  })

  it('gives India Post transit days by zone, and COD only when turned on', async () => {
    const p = new IndiaPostProvider(config({ dataGovApiKey: 'test-key', codEnabled: 'true' }), {
      fetchImpl: mockApi(),
      loadDirectory: noDirectory,
    })
    expect(
      await p.checkServiceability({ originPincode: '131028', destinationPincode: '122001' }),
    ).toMatchObject({ serviceable: true, codAvailable: true, minTransitDays: 1, maxTransitDays: 5 })
    expect(
      await p.checkServiceability({ originPincode: '131028', destinationPincode: '781001' }),
    ).toMatchObject({ serviceable: true, minTransitDays: 4, maxTransitDays: 7 })
  })

  it('falls back to the bundled directory when data.gov.in is down', async () => {
    const directory = decodePincodeDirectory({
      v: 1,
      source: 'test',
      districts: ['Sonipat', 'Gurugram'],
      rows: [
        [131028, 0, 'HR'],
        [122001, 1, 'HR'],
      ],
    })
    const p = new IndiaPostProvider(config({ dataGovApiKey: 'test-key' }), {
      fetchImpl: vi.fn(async () => {
        throw new TypeError('fetch failed')
      }),
      loadDirectory: async () => directory,
    })
    expect(await p.place('122001')).toMatchObject({
      district: 'Gurugram',
      state: 'HR',
      source: 'directory',
    })
    const r = await p.checkServiceability({ originPincode: '131028', destinationPincode: '122001' })
    expect(r).toMatchObject({ serviceable: true, maxTransitDays: 5 })
  })

  it('still answers from the digits with no directory at all', async () => {
    const p = new IndiaPostProvider(config(), { loadDirectory: noDirectory })
    const r = await p.checkServiceability({ originPincode: '131028', destinationPincode: '560001' })
    expect(r).toMatchObject({ serviceable: true, codAvailable: false, minTransitDays: 4 })
    expect(
      await p.checkServiceability({ originPincode: '131028', destinationPincode: '012345' }),
    ).toMatchObject({ serviceable: false })
  })
})

describe('rates', () => {
  const query = {
    originPincode: '131028',
    destinationPincode: '560001',
    weightGrams: 800,
    declaredValuePaise: 199900,
    paymentMode: 'prepaid' as const,
  }

  it('quotes Speed Post and registered Speed Post from the retail card, GST itemised', async () => {
    const p = new IndiaPostProvider(config(), { loadDirectory: noDirectory })
    const options = await p.quoteOptions(query)
    expect(options.map((o) => [o.serviceId, o.pricePaise])).toEqual([
      ['speed_post', 14300 + Math.round(14300 * 0.18)],
      ['speed_post_registered', 14800 + Math.round(14800 * 0.18)],
    ])
    expect(options[0]?.charges).toEqual([
      { kind: 'freight', pricePaise: 14300 },
      { kind: 'gst', pricePaise: 2574 },
    ])
  })

  it('uses the contractual card, and the merchant card over both', async () => {
    const contract = new IndiaPostProvider(config({ contractRates: 'true' }), {
      loadDirectory: noDirectory,
    })
    expect((await contract.quoteOptions(query))[0]?.charges[0]).toEqual({
      kind: 'freight',
      pricePaise: 7100,
    })
    const own = new IndiaPostProvider(
      config({
        tariffOverride: JSON.stringify({
          slabs: [
            { upToGrams: 1000, rupees: { local: 1, withinState: 2, metro: 3, otherStates: 4 } },
          ],
          additionalKgRupees: { local: 1, withinState: 1, metro: 1, otherStates: 1 },
        }),
      }),
      { loadDirectory: noDirectory },
    )
    expect((await own.quoteOptions(query))[0]?.charges[0]).toEqual({
      kind: 'freight',
      pricePaise: 400,
    })
  })

  it('offers nothing for COD unless COD is on, and adds the COD fee when it is', async () => {
    const cod = { ...query, weightGrams: 400, paymentMode: 'cod' as const }
    const off = new IndiaPostProvider(config(), { loadDirectory: noDirectory })
    expect(await off.quoteOptions(cod)).toEqual([])
    const on = new IndiaPostProvider(config({ codEnabled: 'true', codFeeRupees: '30' }), {
      loadDirectory: noDirectory,
    })
    expect((await on.quoteOptions(cod))[0]?.charges).toContainEqual({
      kind: 'cod',
      pricePaise: 3000,
    })
  })
})

describe('booking by article number', () => {
  const p = () =>
    new IndiaPostProvider(config({ codEnabled: 'true' }), { loadDirectory: noDirectory })

  it('needs a valid article number', async () => {
    await expect(p().createShipment(sampleShipment)).rejects.toThrow(/article number/)
    await expect(
      p().createShipment({ ...sampleShipment, trackingNumber: 'EE123456789IN' }),
    ).rejects.toBeInstanceOf(CourierError)
  })

  it('records the number, our label, the tracker link and the price', async () => {
    const r = await p().createShipment({
      ...sampleShipment,
      trackingNumber: 'ee 123456785 in',
      paymentMode: 'cod',
      codAmountPaise: 129900,
      serviceId: SPEED_POST_REGISTERED,
    })
    expect(r).toEqual({
      waybill: 'EE123456785IN',
      providerRef: 'svc=registered;cod=129900',
      labelUrl: '/apps/india-post/labels/EE123456785IN',
      trackingUrl: 'https://www.indiapost.gov.in/',
      // 500 g, Sonipat to Bengaluru: Other States ₹90, registration ₹5, GST 18 %.
      chargePaise: 9000 + 500 + Math.round((9000 + 500) * 0.18),
    })
    expect(decodeLabelRef(r.providerRef)).toEqual({ registered: true, codPaise: 129900 })
  })

  it('refuses COD when the merchant has not turned it on', async () => {
    const off = new IndiaPostProvider(config(), { loadDirectory: noDirectory })
    await expect(
      off.createShipment({
        ...sampleShipment,
        trackingNumber: 'EE123456785IN',
        paymentMode: 'cod',
      }),
    ).rejects.toThrow(/Cash on delivery is off/)
  })

  it('has no feed to track; cancelling is local', async () => {
    await expect(p().track('EE123456785IN')).rejects.toThrow(/Update the status/)
    await expect(p().cancel('EE123456785IN')).resolves.toBeUndefined()
    expect(p().tracksManually).toBe(true)
    expect(p().requiresTrackingNumber).toBe(true)
  })
})

describe('statuses and label facts', () => {
  it('maps India Post tracker wording', () => {
    expect(mapIndiaPostStatus('Item Booked')).toBe('picked_up')
    expect(mapIndiaPostStatus('Item Bagged')).toBe('in_transit')
    expect(mapIndiaPostStatus('Out for Delivery')).toBe('out_for_delivery')
    expect(mapIndiaPostStatus('Item Delivered')).toBe('delivered')
    expect(mapIndiaPostStatus('Item Returned to Sender')).toBe('rto')
    expect(mapIndiaPostStatus('Something new')).toBe('in_transit')
  })

  it('round-trips the label reference and reads an empty one as prepaid Speed Post', () => {
    expect(decodeLabelRef(encodeLabelRef({ registered: false, codPaise: 0 }))).toEqual({
      registered: false,
      codPaise: 0,
    })
    expect(decodeLabelRef(null)).toEqual({ registered: false, codPaise: 0 })
  })
})

describe('verifyCredentials', () => {
  it('names the origin post office with a key, and explains a refused key', async () => {
    const good = new IndiaPostProvider(config({ dataGovApiKey: 'test-key' }), {
      fetchImpl: mockApi(),
      loadDirectory: noDirectory,
    })
    expect(await good.verifyCredentials()).toEqual({
      ok: true,
      message: 'Connected to data.gov.in. Your parcels leave from Kundli S.O, Sonipat.',
    })
    const refused = new IndiaPostProvider(config({ dataGovApiKey: 'test-key' }), {
      fetchImpl: mockApi({ status: 403 }),
      loadDirectory: noDirectory,
    })
    const r = await refused.verifyCredentials()
    expect(r.ok).toBe(false)
    expect(r.message).toMatch(/did not accept that API key/)
  })

  it('is ready without a key', async () => {
    const p = new IndiaPostProvider(config(), { loadDirectory: noDirectory })
    expect(await p.verifyCredentials()).toMatchObject({ ok: true })
  })
})
