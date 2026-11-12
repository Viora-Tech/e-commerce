/** SOURCE OF TRUTH: Delhivery Protect tests — WHAT: the owner's rate card, the taxonomy and
 * product-type mapping, Multi-category and Undetermined, the fee's rounding, and where a route's
 * insurance price comes from / WHY: the courier drawer, checkout and booking all price from it. */
import { describe, expect, it } from 'vitest'
import { DeliveryOptionInputSchema } from './config'
import { priceRoute } from './price'
import {
  DEFAULT_PROTECT_BPS,
  DEFAULT_PROTECT_CARD,
  itemProtectCategory,
  PROTECT_CATEGORIES,
  type ProtectCard,
  parcelProtect,
  parcelProtectCategory,
  parseProtectCard,
  protectFeePaise,
  taxonomyProtectCategory,
  typeProtectCategory,
} from './protect'
import type { ResolveInput } from './resolve-types'
import { insuranceQuote, type Route } from './routes'

const card = DEFAULT_PROTECT_CARD

describe('Delhivery Protect rate card', () => {
  it('holds the owner’s 25 categories at their rates', () => {
    expect(PROTECT_CATEGORIES).toHaveLength(25)
    expect(DEFAULT_PROTECT_BPS.apparel).toBe(25)
    expect(DEFAULT_PROTECT_BPS.health).toBe(30)
    expect(DEFAULT_PROTECT_BPS.books).toBe(35)
    expect(DEFAULT_PROTECT_BPS.computers).toBe(40)
    expect(DEFAULT_PROTECT_BPS.undetermined).toBe(60)
    expect(DEFAULT_PROTECT_BPS.multi).toBe(60)
  })

  it('₹10,000 of Health and Wellness costs ₹30', () => {
    const { bps } = parcelProtect([{ categoryId: 'hb-1-9' }], card)
    expect(bps).toBe(30)
    expect(protectFeePaise(1_000_000, bps)).toBe(3000)
  })

  it('₹8,999 of a computer accessory costs ₹36 (₹35.996 to the paisa)', () => {
    const { category, bps } = parcelProtect([{ categoryId: 'el-7-8-8' }], card)
    expect(category).toBe('computers')
    expect(protectFeePaise(899_900, bps)).toBe(3600)
  })

  it('rounds to the paisa as Delhivery does and never goes below zero', () => {
    // ₹4,699 × 0.40% = ₹18.796 → ₹18.80.
    expect(protectFeePaise(469_900, 40)).toBe(1880)
    expect(protectFeePaise(-500, 40)).toBe(0)
  })
})

describe('mapping products to a Protect category', () => {
  it('computer peripherals are Computers, Laptops and Accessories (0.40%)', () => {
    expect(taxonomyProtectCategory('el-7-9-11-4-3')).toBe('computers') // Mouse Skates
    expect(taxonomyProtectCategory('el-7-9-12-11')).toBe('computers') // Mice & Trackballs
    expect(taxonomyProtectCategory('el-7-9-12-8')).toBe('computers') // Keyboards
    expect(taxonomyProtectCategory('el-7-8-8')).toBe('computers') // Mouse Pads
    expect(
      parcelProtect([{ categoryId: 'el-7-9-12-11' }, { categoryId: 'el-7-8-8' }], card),
    ).toEqual({ category: 'computers', bps: 40 })
  })

  it('the longest taxonomy branch wins', () => {
    expect(taxonomyProtectCategory('el-2-2-7-1')).toBe('electronics') // Headphones
    expect(taxonomyProtectCategory('el-7-15-1-4')).toBe('batteries')
    expect(taxonomyProtectCategory('aa-1-13')).toBe('apparel')
    expect(taxonomyProtectCategory('aa-8-3')).toBe('footwear')
    expect(taxonomyProtectCategory('aa-6-11')).toBe('watches_jewellery')
    expect(taxonomyProtectCategory('lb-1')).toBe('bags')
    expect(taxonomyProtectCategory('hb-3-2')).toBe('beauty')
    expect(taxonomyProtectCategory('el-6-8')).toBe('mobiles')
    // A prefix must end at a dash: `el-1` does not cover `el-12` (Networking).
    expect(taxonomyProtectCategory('el-12-3')).toBe('computers')
  })

  it('verticals with no Delhivery category are not guessed', () => {
    expect(taxonomyProtectCategory('gc')).toBeNull()
    expect(taxonomyProtectCategory('na')).toBeNull()
    expect(taxonomyProtectCategory(null)).toBeNull()
  })

  it('a product with no category is placed by the words in its type (Waimers’ types)', () => {
    for (const type of ['Glasspads', 'Mouse Skates', 'Mice', 'Mousepad', 'Keyboard', 'Keycaps']) {
      expect(typeProtectCategory(type)).toBe('computers')
    }
    expect(typeProtectCategory('Gift Card')).toBeNull()
  })

  it('the merchant’s product-type override beats the taxonomy', () => {
    const own: ProtectCard = {
      ratesBps: {},
      typeOverrides: [{ productType: 'glasspads', category: 'home_kitchen' }],
      couriers: {},
    }
    expect(itemProtectCategory({ categoryId: 'el-7-8-8', productType: 'Glasspads' }, own)).toBe(
      'home_kitchen',
    )
  })

  it('products from two categories are Multi-category (0.60%)', () => {
    const items = [{ categoryId: 'el-7-8-8' }, { categoryId: 'aa-1-13' }]
    expect(parcelProtect(items, card)).toEqual({ category: 'multi', bps: 60 })
  })

  it('an unmapped product, or none at all, is Undetermined (0.60%)', () => {
    expect(parcelProtect([{ productType: 'Widget' }], card)).toEqual({
      category: 'undetermined',
      bps: 60,
    })
    expect(parcelProtectCategory([], card)).toBe('undetermined')
  })

  it('the merchant’s rate replaces Delhivery’s for that category only', () => {
    const own = parseProtectCard({ ratesBps: { computers: 50 } })
    expect(parcelProtect([{ categoryId: 'el-7-8-8' }], own).bps).toBe(50)
    expect(parcelProtect([{ categoryId: 'hb-1-9' }], own).bps).toBe(30)
  })

  it('a broken saved card falls back to the defaults', () => {
    expect(parseProtectCard({ ratesBps: { computers: 'x' } })).toEqual(DEFAULT_PROTECT_CARD)
    expect(parseProtectCard(undefined)).toEqual(DEFAULT_PROTECT_CARD)
  })
})

const route = (over: Partial<Route> = {}): Route => ({
  key: 'delhivery:S',
  providerId: 'delhivery',
  providerLabel: 'Delhivery',
  channel: 'direct',
  carrierKey: 'delhivery',
  carrier: 'Delhivery',
  showCarrier: true,
  serviceId: 'S',
  serviceLabel: 'Surface',
  speed: 'standard',
  costPaise: 6000,
  codCostPaise: null,
  costFromCard: false,
  quotedInsurancePaise: null,
  minTransitDays: 4,
  maxTransitDays: 5,
  codAvailable: true,
  serviceable: true,
  insures: true,
  insurancePercent: null,
  insuranceMinPaise: null,
  enabled: true,
  source: 'live',
  ms: 100,
  ...over,
})

describe('where a route’s insurance price comes from', () => {
  const computers = { category: 'computers' as const, bps: 40 }

  it('Delhivery direct with no rate of its own: Delhivery Protect plus 18% GST', () => {
    // Owner's Delhivery quote: declared ₹24,250 × 0.40% = ₹97.00, GST ₹17.46.
    expect(insuranceQuote(route(), 2_425_000, computers)).toEqual({
      source: 'protect',
      feePaise: 9700,
      gstPaise: 1746,
      pricePaise: 11_446,
      gstIncluded: false,
      estimate: false,
      protect: computers,
    })
    // ₹4,699: ₹18.80 + GST ₹3.38.
    expect(insuranceQuote(route(), 469_900, computers)).toMatchObject({
      feePaise: 1880,
      gstPaise: 338,
      pricePaise: 2218,
    })
  })

  it('RapidShyp, every carrier: 0.89% of the value plus 18% GST', () => {
    const rapidshyp = (over: Partial<Route> = {}) =>
      route({
        key: 'rapidshyp:bd',
        providerId: 'rapidshyp',
        channel: 'aggregator',
        carrierKey: 'bluedart',
        ...over,
      })
    // Owner's RapidShyp quotes: ₹4,699 → ₹49.35, ₹26,899 → ₹282.49.
    expect(insuranceQuote(rapidshyp(), 469_900, computers)).toMatchObject({
      source: 'courier_rate',
      feePaise: 4182,
      gstPaise: 753,
      pricePaise: 4935,
    })
    expect(insuranceQuote(rapidshyp({ carrierKey: 'delhivery' }), 2_689_900)?.pricePaise).toBe(
      28_249,
    )
    // The merchant's own rate on a RapidShyp route replaces the 0.89%.
    expect(insuranceQuote(rapidshyp({ insurancePercent: 1 }), 469_900)).toMatchObject({
      source: 'route',
      feePaise: 4699,
    })
  })

  it('a rate the merchant set on the route wins, with GST on top', () => {
    const q = insuranceQuote(route({ insurancePercent: 1 }), 899_900, computers)
    expect(q).toMatchObject({ source: 'route', feePaise: 8999, gstPaise: 1620, pricePaise: 10_619 })
  })

  it('Shiprocket, every carrier: 1.05% of the value, GST included, exact', () => {
    // Owner's Shiprocket quotes (price with insurance − price without).
    const viaShiprocket = route({ channel: 'aggregator', providerId: 'shiprocket' })
    expect(insuranceQuote(viaShiprocket, 999_900, computers)).toEqual({
      source: 'courier_rate',
      feePaise: 10_499,
      gstPaise: 0,
      pricePaise: 10_499,
      gstIncluded: true,
      estimate: false,
      protect: null,
    })
    expect(insuranceQuote(viaShiprocket, 1_488_900)?.pricePaise).toBe(15_633)
    expect(insuranceQuote(viaShiprocket, 1_929_700)?.pricePaise).toBe(20_262)
  })

  it('RapidShyp is an estimate, Delhivery Protect is exact', () => {
    const rapid = route({ providerId: 'rapidshyp', channel: 'aggregator' })
    expect(insuranceQuote(rapid, 469_900)).toMatchObject({ estimate: true, gstIncluded: false })
    expect(insuranceQuote(route(), 469_900, computers)).toMatchObject({ estimate: false })
  })

  it('another direct courier with no rate (Blue Dart): not priced', () => {
    expect(insuranceQuote(route({ carrierKey: 'bluedart' }), 899_900, computers)).toBeNull()
  })

  it('a courier’s own quoted line is taken as it is (already taxed)', () => {
    expect(insuranceQuote(route({ quotedInsurancePaise: 2500 }), 899_900, computers)).toEqual({
      source: 'courier',
      feePaise: 2500,
      gstPaise: 0,
      pricePaise: 2500,
      gstIncluded: true,
      estimate: false,
      protect: null,
    })
  })

  it('checkout prices an insured Delhivery route with Protect for the cart’s products', () => {
    const option = {
      ...DeliveryOptionInputSchema.parse({ name: 'Standard' }),
      id: 'std',
      position: 0,
    }
    const input: ResolveInput = {
      config: { options: [option], rules: [], routeSettings: [], version: 'v1' },
      cart: {
        valuePaise: 1_000_000,
        weightGrams: 400,
        items: [
          { productId: 'p1', collectionIds: [], tags: [], productType: null, categoryId: 'hb-1-9' },
        ],
      },
      answers: [],
      zone: { kind: 'not_configured' },
      policy: {
        cutoff: '18:00',
        timeZone: 'Asia/Kolkata',
        workingDays: [1, 2, 3, 4, 5, 6, 7],
        deliveryDays: [1, 2, 3, 4, 5, 6, 7],
        holidays: [],
        defaultMinTransitDays: 4,
        defaultMaxTransitDays: 6,
        codAllowed: true,
      },
      now: new Date('2026-11-02T04:30:00Z'),
    }
    const priced = priceRoute(route(), option, input, true, false)
    // ₹60 courier + ₹30 Protect (₹10,000 of Health and Wellness at 0.30%) + ₹5.40 GST = ₹95.40
    // → ₹100.
    expect(priced?.insurancePaise).toBe(3540)
    expect(priced?.listPricePaise).toBe(10_000)
  })
})
