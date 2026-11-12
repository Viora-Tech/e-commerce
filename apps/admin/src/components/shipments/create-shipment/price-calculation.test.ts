import type { CourierRateRow, RowCover, RowInsurance } from '@commerce/core'
import { describe, expect, it } from 'vitest'
import { insuredRows } from './insured-rows'
import {
  type PriceCalculation,
  priceCalculation,
  summaryParts,
  weightCalculation,
} from './price-calculation'

const COVER: RowCover = {
  valuePaise: 2_425_000,
  hasUsedItems: false,
  coverCapPaise: null,
  uninsuredLimitPaise: null,
  coversFragile: null,
  excludesUsed: null,
  deductibleBps: null,
}

const row = (over: Partial<CourierRateRow> = {}): CourierRateRow => ({
  optionKey: 'delhivery:S',
  providerId: 'delhivery',
  providerName: 'Delhivery',
  providerLabel: 'Delhivery Surface',
  serviceId: 'S',
  serviceLabel: 'Surface',
  carrier: null,
  charges: [],
  chargeableWeightGrams: null,
  pricePaise: 10_000,
  minTransitDays: 3,
  maxTransitDays: 5,
  codAvailable: true,
  problem: null,
  problemDetail: null,
  deliveryBy: null,
  etaFromSettings: false,
  badges: [],
  insurance: null,
  cover: COVER,
  ...over,
})

const insurance = (over: Partial<RowInsurance>): RowInsurance => ({
  source: 'courier_rate',
  feePaise: 0,
  gstPaise: 0,
  pricePaise: 0,
  gstIncluded: false,
  estimate: false,
  protectCategory: null,
  protectBps: null,
  rateBps: null,
  ...over,
})

const sum = (calc: PriceCalculation | null) =>
  (calc?.lines ?? []).reduce((total, line) => total + line.paise, 0)

/** The row as the drawer shows it (insurance added to the price), and its calculation. */
const shown = (r: CourierRateRow, insured: boolean) => {
  const [displayed] = insuredRows([r], insured)
  if (!displayed) throw new Error('no row')
  return { displayed, calc: priceCalculation(displayed, { insured }) }
}

describe('price calculation', () => {
  it('Delhivery itemised + Protect: 0.40% × ₹24,250 = ₹97 + 18% GST ₹17.46', () => {
    const delhivery = row({
      charges: [
        { kind: 'gst', pricePaise: 1800 },
        { kind: 'freight', pricePaise: 8000 },
        { kind: 'fuel', pricePaise: 1000 },
        { kind: 'cod', pricePaise: 1200 },
      ],
      pricePaise: 12_000,
      insurance: insurance({
        source: 'protect',
        feePaise: 9700,
        gstPaise: 1746,
        pricePaise: 11_446,
        protectCategory: 'computers',
        protectBps: 40,
        rateBps: 40,
      }),
    })
    const { displayed, calc } = shown(delhivery, true)
    expect(calc?.lines).toEqual([
      { kind: 'charge', charge: 'freight', paise: 8000 },
      { kind: 'charge', charge: 'fuel', paise: 1000 },
      { kind: 'charge', charge: 'cod', paise: 1200 },
      { kind: 'charge', charge: 'gst', paise: 1800 },
      {
        kind: 'insuranceFee',
        paise: 9700,
        rateBps: 40,
        valuePaise: 2_425_000,
        gstIncluded: false,
        estimate: false,
      },
      { kind: 'insuranceGst', paise: 1746, gstBps: 1800, estimate: false },
    ])
    expect(calc?.totalPaise).toBe(displayed.pricePaise)
    expect(sum(calc)).toBe(23_446)
    expect(calc?.insurance).toBe('added')
  })

  it('RapidShyp gives one total: never split, insurance added as an estimate', () => {
    const rapid = row({
      providerId: 'rapidshyp',
      providerName: 'RapidShyp',
      providerLabel: 'Bluedart Air (RapidShyp)',
      pricePaise: 9_440,
      insurance: insurance({
        feePaise: 4182,
        gstPaise: 753,
        pricePaise: 4935,
        rateBps: 89,
        estimate: true,
      }),
      cover: { ...COVER, valuePaise: 469_900 },
    })
    const { displayed, calc } = shown(rapid, true)
    expect(calc?.lines).toEqual([
      { kind: 'courierTotal', paise: 9_440 },
      {
        kind: 'insuranceFee',
        paise: 4182,
        rateBps: 89,
        valuePaise: 469_900,
        gstIncluded: false,
        estimate: true,
      },
      { kind: 'insuranceGst', paise: 753, gstBps: 1800, estimate: true },
    ])
    expect(sum(calc)).toBe(displayed.pricePaise)
    expect(displayed.pricePaise).toBe(9_440 + 4935)
  })

  it('Shiprocket total-only with its 1.05% incl. GST: one insurance line, no GST line', () => {
    const ship = row({
      providerId: 'shiprocket',
      providerName: 'Shiprocket',
      pricePaise: 8_500,
      insurance: insurance({
        feePaise: 15_633,
        pricePaise: 15_633,
        gstIncluded: true,
        rateBps: 105,
      }),
      cover: { ...COVER, valuePaise: 1_488_900 },
    })
    const { displayed, calc } = shown(ship, true)
    expect(calc?.lines.map((l) => l.kind)).toEqual(['courierTotal', 'insuranceFee'])
    expect(calc?.lines[1]).toMatchObject({ gstIncluded: true, rateBps: 105 })
    expect(sum(calc)).toBe(displayed.pricePaise)
  })

  it('Shiprocket parts that leave its GST out: the gap is shown, a paisa gap is rounding', () => {
    const parts = row({
      providerId: 'shiprocket',
      charges: [
        { kind: 'freight', pricePaise: 7000 },
        { kind: 'cod', pricePaise: 500 },
      ],
      pricePaise: 8_850,
    })
    const calc = priceCalculation(parts, { insured: false })
    expect(calc?.lines.at(-1)).toEqual({ kind: 'unitemised', paise: 1350 })
    expect(sum(calc)).toBe(8_850)
    const nearly = priceCalculation(row({ ...parts, pricePaise: 7_501 }), { insured: false })
    expect(nearly?.lines.at(-1)).toEqual({ kind: 'rounding', paise: 1 })
    expect(sum(nearly)).toBe(7_501)
  })

  it('a courier’s own insurance line is not counted twice', () => {
    const quoted = row({
      providerId: 'shiprocket',
      charges: [
        { kind: 'freight', pricePaise: 7000 },
        { kind: 'insurance', pricePaise: 2500 },
      ],
      pricePaise: 9_500,
      insurance: insurance({
        source: 'courier',
        feePaise: 2500,
        pricePaise: 2500,
        gstIncluded: true,
      }),
    })
    const { displayed, calc } = shown(quoted, true)
    expect(displayed.pricePaise).toBe(9_500)
    expect(calc?.insurance).toBe('included')
    expect(calc?.lines.filter((l) => l.kind === 'insuranceFee')).toHaveLength(0)
    expect(sum(calc)).toBe(9_500)
  })

  it('insurance off or unset adds no lines', () => {
    const r = row({ insurance: insurance({ feePaise: 100, gstPaise: 18, pricePaise: 118 }) })
    expect(priceCalculation(r, { insured: false })?.lines).toEqual([
      { kind: 'courierTotal', paise: 10_000 },
    ])
    const unset = priceCalculation(row({ insurance: null }), { insured: true })
    expect(unset?.insurance).toBe('unset')
    expect(sum(unset)).toBe(10_000)
  })

  it('no calculation for a row without a price or that cannot take the parcel', () => {
    expect(priceCalculation(row({ pricePaise: null }), { insured: false })).toBeNull()
    expect(priceCalculation(row({ problem: 'no_cod' }), { insured: false })).toBeNull()
  })
})

describe('weight calculation', () => {
  it('a light, bulky box is charged on volumetric: 30 × 20 × 10 ÷ 5000 = 1.2 kg', () => {
    const w = weightCalculation(
      { weightGrams: 800, dimensionsCm: { length: 30, width: 20, height: 10 } },
      null,
    )
    expect(w).toEqual({
      deadGrams: 800,
      volumetric: { lengthCm: 30, widthCm: 20, heightCm: 10, divisor: 5000, grams: 1200 },
      billedGrams: 1200,
      basis: 'volumetric',
      courierGrams: null,
    })
  })

  it('a heavy, small box is charged on dead weight; the courier’s own slab is kept', () => {
    const w = weightCalculation(
      { weightGrams: 2_000, dimensionsCm: { length: 20, width: 20, height: 5 } },
      2_500,
    )
    expect(w).toMatchObject({ billedGrams: 2_000, basis: 'dead', courierGrams: 2_500 })
    expect(w.volumetric?.grams).toBe(400)
  })

  it('no box size: dead weight only; the courier’s weight is hidden when it matches', () => {
    expect(weightCalculation({ weightGrams: 900 }, 900)).toMatchObject({
      volumetric: null,
      billedGrams: 900,
      basis: 'dead',
      courierGrams: null,
    })
  })

  it('without the package, the quote’s charged weight stands alone', () => {
    expect(weightCalculation(null, null, 1_010)).toMatchObject({
      deadGrams: null,
      billedGrams: 1_010,
      basis: null,
    })
  })
})

describe('summary parts', () => {
  it('splits the price into freight, insurance and GST that add up to it', () => {
    const r = row({
      pricePaise: 10_000,
      charges: [
        { kind: 'freight', pricePaise: 7_500 },
        { kind: 'cod', pricePaise: 1_000 },
        { kind: 'gst', pricePaise: 1_500 },
      ],
      insurance: insurance({ feePaise: 2_000, gstPaise: 360, pricePaise: 2_360 }),
    })
    const { calc } = shown(r, true)
    if (!calc) throw new Error('no calc')
    const parts = summaryParts(calc)
    expect(parts).toEqual({ freightPaise: 8_500, insurancePaise: 2_000, gstPaise: 1_860 })
    expect(parts.freightPaise + (parts.insurancePaise ?? 0) + (parts.gstPaise ?? 0)).toBe(
      calc.totalPaise,
    )
  })

  it('a courier total with no insurance is all freight', () => {
    const { calc } = shown(row({ pricePaise: 9_000 }), false)
    if (!calc) throw new Error('no calc')
    expect(summaryParts(calc)).toEqual({
      freightPaise: 9_000,
      insurancePaise: null,
      gstPaise: null,
    })
  })
})
