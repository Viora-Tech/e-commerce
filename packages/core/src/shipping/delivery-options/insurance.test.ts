/** SOURCE OF TRUTH: rate-row insurance tests — WHAT: what the Create shipment drawer's insurance
 * switch adds to a Delhivery row (Protect), an aggregator row (its route rate, else nothing) and
 * a row whose quote itemised insurance / WHY: drawer, booking and margin share `rowInsurance`. */
import { describe, expect, it } from 'vitest'
import type { CourierRateRow } from '../courier-rates'
import { type InsuranceFacts, rowCover, rowInsurance } from './insurance'
import {
  courierCover,
  coveredPaise,
  DEFAULT_PROTECT_CARD,
  isUsedProduct,
  parseProtectCard,
} from './protect'

const row = (over: Partial<CourierRateRow> = {}): CourierRateRow => ({
  optionKey: 'delhivery:S',
  providerId: 'delhivery',
  providerName: 'Delhivery',
  providerLabel: 'Delhivery Surface',
  serviceId: 'S',
  serviceLabel: 'Surface',
  carrier: null,
  charges: [],
  chargeableWeightGrams: 1000,
  pricePaise: 9000,
  minTransitDays: 3,
  maxTransitDays: 5,
  codAvailable: true,
  problem: null,
  problemDetail: null,
  deliveryBy: null,
  etaFromSettings: false,
  badges: [],
  ...over,
})

const facts = (over: Partial<InsuranceFacts> = {}): InsuranceFacts => ({
  settings: [],
  protect: { category: 'computers', bps: 40 },
  card: DEFAULT_PROTECT_CARD,
  hasUsedItems: false,
  ...over,
})

describe('rowCover: what each courier pays if the parcel is lost', () => {
  it('Delhivery Protect covers the declared value up to ₹30,000', () => {
    const c = rowCover(row(), facts(), 4_000_000)
    expect(c).toMatchObject({ valuePaise: 4_000_000, coverCapPaise: 3_000_000 })
    expect(coveredPaise(c.valuePaise, c.coverCapPaise)).toBe(3_000_000)
  })

  it('Shiprocket: ₹4,75,000 insured, ₹2,500 uninsured, fragile yes, used no, 0.5% excess', () => {
    const c = rowCover({ providerId: 'shiprocket' }, facts({ hasUsedItems: true }), 1_349_900)
    expect(c).toEqual({
      valuePaise: 1_349_900,
      coverCapPaise: 47_500_000,
      uninsuredLimitPaise: 250_000,
      coversFragile: true,
      excludesUsed: true,
      deductibleBps: 50,
      hasUsedItems: true,
    })
  })

  it('RapidShyp: ₹2,500 uninsured (ToS 8.1), its insured cap not known', () => {
    expect(rowCover({ providerId: 'rapidshyp' }, facts(), 100_000)).toMatchObject({
      coverCapPaise: null,
      uninsuredLimitPaise: 250_000,
      coversFragile: null,
    })
  })

  it('an unknown courier: nothing known, so no cap and no warning', () => {
    expect(rowCover({ providerId: 'bluedart' }, facts(), 100_000)).toMatchObject({
      coverCapPaise: null,
      uninsuredLimitPaise: null,
      excludesUsed: null,
    })
  })

  it('the merchant’s own terms replace the courier’s', () => {
    const card = parseProtectCard({ couriers: { shiprocket: { uninsuredLimitPaise: 500_000 } } })
    expect(courierCover('shiprocket', card)).toMatchObject({
      uninsuredLimitPaise: 500_000,
      coverCapPaise: 47_500_000,
    })
  })

  it('open-box products are spotted by tag or by the "[OPEN BOX]" title prefix', () => {
    expect(isUsedProduct({ title: '[OPEN BOX] Wraith W60 Wireless' })).toBe(true)
    expect(isUsedProduct({ title: 'Wraith W60', tags: ['Open-Box'] })).toBe(true)
    expect(isUsedProduct({ title: 'Wraith W60 (open box sale)', tags: ['mice'] })).toBe(false)
  })
})

describe('rowInsurance', () => {
  it('Delhivery direct: Protect for the parcel (₹8,999 of mouse pads → ₹36 + ₹6.48 GST)', () => {
    expect(rowInsurance(row(), facts(), 899_900)).toEqual({
      source: 'protect',
      feePaise: 3600,
      gstPaise: 648,
      pricePaise: 4248,
      gstIncluded: false,
      estimate: false,
      protectCategory: 'computers',
      protectBps: 40,
    })
  })

  it('RapidShyp: its 0.89% + GST on any carrier (₹26,899 → ₹282.49)', () => {
    const viaRapidShyp = row({
      providerId: 'rapidshyp',
      providerName: 'RapidShyp',
      serviceId: 'bd-air',
      serviceLabel: 'Bluedart Air',
      carrier: 'Blue Dart',
    })
    expect(rowInsurance(viaRapidShyp, facts(), 2_689_900)).toMatchObject({
      source: 'courier_rate',
      pricePaise: 28_249,
    })
  })

  it('Shiprocket: 1.05% GST included, one exact figure (₹14,889 → ₹156.33)', () => {
    const viaShiprocket = row({
      optionKey: 'shiprocket:12',
      providerId: 'shiprocket',
      providerName: 'Shiprocket',
      serviceId: '12',
      serviceLabel: 'Delhivery Surface',
      carrier: 'Delhivery',
    })
    expect(rowInsurance(viaShiprocket, facts(), 1_488_900)).toMatchObject({
      source: 'courier_rate',
      pricePaise: 15_633,
      gstIncluded: true,
      estimate: false,
    })
  })

  it('a direct courier with no rate (Blue Dart) is not priced', () => {
    const blueDart = row({
      optionKey: 'bluedart',
      providerId: 'bluedart',
      providerName: 'Blue Dart',
      serviceId: null,
      serviceLabel: null,
    })
    expect(rowInsurance(blueDart, facts(), 899_900)).toBeNull()
  })

  it('an aggregator route with the merchant’s rate uses it', () => {
    const viaShiprocket = row({
      providerId: 'shiprocket',
      providerName: 'Shiprocket',
      serviceId: '12',
      serviceLabel: 'Bluedart Air',
      carrier: 'Blue Dart',
    })
    const settings = [
      { key: 'carrier:bluedart|channel:shiprocket', insurancePercent: 0.5, enabled: true },
    ]
    // ₹8,999 × 0.5% = ₹45.00 (₹44.995 to the paisa) + ₹8.10 GST.
    expect(rowInsurance(viaShiprocket, facts({ settings }), 899_900)).toMatchObject({
      source: 'route',
      feePaise: 4500,
      pricePaise: 5310,
    })
  })

  it('a quote that itemised insurance already has it in its price', () => {
    const quoted = row({ charges: [{ kind: 'insurance', pricePaise: 2500 }] })
    expect(rowInsurance(quoted, facts(), 899_900)).toMatchObject({
      source: 'courier',
      pricePaise: 2500,
    })
  })
})
