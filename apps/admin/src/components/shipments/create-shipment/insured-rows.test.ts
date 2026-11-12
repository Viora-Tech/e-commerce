import type { CourierRateRow, RowInsurance } from '@commerce/core'
import { describe, expect, it } from 'vitest'
import { insuredRows, rowInsuranceState } from './insured-rows'

/** ₹8,999 of mouse pads: Delhivery Protect at 0.40% = ₹36 + ₹6.48 GST. */
const PROTECT: RowInsurance = {
  source: 'protect',
  feePaise: 3600,
  gstPaise: 648,
  pricePaise: 4248,
  gstIncluded: false,
  estimate: false,
  protectCategory: 'computers',
  protectBps: 40,
}

const row = (over: Partial<CourierRateRow> = {}): CourierRateRow => ({
  optionKey: 'delhivery:S',
  providerId: 'delhivery',
  providerName: 'Delhivery',
  providerLabel: 'Delhivery Surface',
  serviceId: 'S',
  serviceLabel: 'Surface',
  carrier: null,
  charges: [
    { kind: 'freight', pricePaise: 7000 },
    { kind: 'gst', pricePaise: 1260 },
  ],
  chargeableWeightGrams: 1000,
  pricePaise: 8260,
  minTransitDays: 4,
  maxTransitDays: 5,
  codAvailable: true,
  problem: null,
  problemDetail: null,
  deliveryBy: null,
  etaFromSettings: false,
  badges: [],
  insurance: PROTECT,
  ...over,
})

/** Blue Dart via Shiprocket, ₹85, no insurance rate set. */
const shiprocket = row({
  optionKey: 'shiprocket:12',
  providerId: 'shiprocket',
  providerName: 'Shiprocket',
  providerLabel: 'Bluedart Air (Shiprocket)',
  serviceId: '12',
  carrier: 'Blue Dart',
  charges: [],
  pricePaise: 8500,
  minTransitDays: 2,
  insurance: null,
})

describe('the drawer’s Shipping insurance switch', () => {
  it('off: the courier’s own prices', () => {
    const [d] = insuredRows([row()], false)
    expect(d?.pricePaise).toBe(8260)
    expect(rowInsuranceState(row(), false)).toEqual({ kind: 'off' })
  })

  it('on: Delhivery’s total includes Protect and its GST, shown as two exact lines', () => {
    const [d] = insuredRows([row()], true)
    expect(d?.pricePaise).toBe(8260 + 4248)
    expect(rowInsuranceState(row(), true)).toEqual({
      kind: 'added',
      feePaise: 3600,
      gstPaise: 648,
      pricePaise: 4248,
      estimate: false,
      gstIncluded: false,
    })
  })

  it('on: Shiprocket’s 1.05% is one exact GST-inclusive line', () => {
    const ship = row({
      providerId: 'shiprocket',
      insurance: {
        ...PROTECT,
        source: 'courier_rate',
        feePaise: 15_633,
        gstPaise: 0,
        pricePaise: 15_633,
        gstIncluded: true,
        protectCategory: null,
        protectBps: null,
      },
    })
    expect(insuredRows([ship], true)[0]?.pricePaise).toBe(8260 + 15_633)
    expect(rowInsuranceState(ship, true)).toMatchObject({ estimate: false, gstIncluded: true })
  })

  it('on: RapidShyp’s insurance is added and marked as an estimate', () => {
    const rapid = row({
      providerId: 'rapidshyp',
      insurance: {
        ...PROTECT,
        source: 'courier_rate',
        feePaise: 4182,
        gstPaise: 753,
        pricePaise: 4935,
        estimate: true,
        protectCategory: null,
        protectBps: null,
      },
    })
    expect(insuredRows([rapid], true)[0]?.pricePaise).toBe(8260 + 4935)
    expect(rowInsuranceState(rapid, true)).toMatchObject({ kind: 'added', estimate: true })
  })

  it('on: a route with no rate (Shiprocket) adds nothing and says the rate is not set', () => {
    const [, s] = insuredRows([row(), shiprocket], true)
    expect(s?.pricePaise).toBe(8500)
    expect(rowInsuranceState(shiprocket, true)).toEqual({ kind: 'unset' })
  })

  it('on: a quote that itemised insurance is not charged twice', () => {
    const quoted = row({
      charges: [{ kind: 'insurance', pricePaise: 2500 }],
      insurance: { ...PROTECT, source: 'courier', feePaise: 2500, gstPaise: 0, pricePaise: 2500 },
    })
    expect(insuredRows([quoted], true)[0]?.pricePaise).toBe(8260)
    expect(rowInsuranceState(quoted, true)).toEqual({ kind: 'included', pricePaise: 2500 })
  })

  it('Cheapest and Recommended follow the insured totals', () => {
    // On: Delhivery ₹82.60 + ₹42.48 = ₹125.08 loses to Blue Dart's ₹85.
    const on = insuredRows([row(), shiprocket], true)
    expect(on[1]?.badges).toContain('cheapest')
    expect(on[1]?.badges).toContain('recommended')
    expect(on[0]?.badges).not.toContain('cheapest')
  })
})
