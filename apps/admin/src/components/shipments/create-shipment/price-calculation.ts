import type { CourierRateRow } from '@commerce/core'
import { INSURANCE_GST_BPS } from '@commerce/core/delhivery-protect'
import { VOLUMETRIC_DIVISOR, volumetricWeightGrams } from '@commerce/core/parcel'
import { coverNotes } from './cover-notes'
import { type RowInsuranceState, rowInsuranceState } from './insured-rows'

/**
 * How a courier row's price is worked out, line by line, for the Select courier drawer and the
 * courier list (owner, 12 Nov 2026: "we don't see the divide of things"). Pure, so the tests can
 * hold the lines to the row's price. Nothing here prices anything anew: the weight is the one the
 * couriers were asked with (`effectiveWeightGrams`), the courier lines are its own, and the
 * insurance figures are `rowInsuranceState`'s, which `insuredRows` added to the price.
 */

/** The package as typed on the page: what the couriers were asked to price. */
export type ParcelSize = {
  weightGrams: number
  dimensionsCm?: { length: number; width: number; height: number } | undefined
}

export type WeightCalculation = {
  /** The parcel on the scale; null when the page did not pass the package. */
  deadGrams: number | null
  /** L × W × H ÷ divisor, when a box size is known. */
  volumetric: {
    lengthCm: number
    widthCm: number
    heightCm: number
    divisor: number
    grams: number
  } | null
  /** The heavier of the two: the weight every courier was asked to price. */
  billedGrams: number | null
  /** Which of the two set `billedGrams`; null when only the quote's weight is known. */
  basis: 'dead' | 'volumetric' | null
  /** The courier's own charged weight (its slabs and rounding) when it differs from ours. */
  courierGrams: number | null
}

type ChargeKind = CourierRateRow['charges'][number]['kind']

export type CalculationLine =
  /** One line the courier itemised. */
  | { kind: 'charge'; charge: ChargeKind; paise: number }
  /** The courier gave one figure only (RapidShyp; Shiprocket without parts): never split. */
  | { kind: 'courierTotal'; paise: number }
  /** The courier's parts and its total differ by up to ₹1. */
  | { kind: 'rounding'; paise: number }
  /** The courier's parts leave more of its total unexplained (Shiprocket's GST, say). */
  | { kind: 'unitemised'; paise: number }
  /** Insurance added by our own rules: `rateBps` × `valuePaise` = `paise`. */
  | {
      kind: 'insuranceFee'
      paise: number
      /** Null when the route's minimum fee applied. */
      rateBps: number | null
      /** The declared value the fee is priced on; null when the quote did not say. */
      valuePaise: number | null
      gstIncluded: boolean
      estimate: boolean
    }
  | { kind: 'insuranceGst'; paise: number; gstBps: number; estimate: boolean }

export type PriceCalculation = {
  weight: WeightCalculation
  lines: CalculationLine[]
  /** What the insurance switch did to this row (`rowInsuranceState`). */
  insurance: RowInsuranceState['kind']
  /** The row's price: always the sum of `lines`. */
  totalPaise: number
}

/** The courier's lines in the order the drawer lists them (Figma 898:7790). */
export const CHARGE_ORDER: readonly ChargeKind[] = [
  'freight',
  'fuel',
  'cod',
  'insurance',
  'rto',
  'other',
  'gst',
]

/** A gap between the courier's parts and its total up to this is rounding; above it, unitemised. */
export const ROUNDING_LIMIT_PAISE = 100

/** "0.40", "0.89", "1.05": a rate in basis points as a percentage with two decimals. */
export const ratePercent = (bps: number): string => (bps / 100).toFixed(2)

/** Dead weight against volumetric, and the courier's own charged weight. */
export function weightCalculation(
  parcel: ParcelSize | null | undefined,
  courierGrams: number | null,
  /** The quote's charged weight, for when the page did not pass the package. */
  chargedGrams: number | null = null,
): WeightCalculation {
  const dims = parcel?.dimensionsCm
  const volumetric = dims
    ? {
        lengthCm: dims.length,
        widthCm: dims.width,
        heightCm: dims.height,
        divisor: VOLUMETRIC_DIVISOR,
        grams: volumetricWeightGrams({
          lengthCm: dims.length,
          widthCm: dims.width,
          heightCm: dims.height,
        }),
      }
    : null
  const deadGrams = parcel ? parcel.weightGrams : null
  const billedGrams =
    deadGrams === null ? chargedGrams : Math.max(deadGrams, volumetric?.grams ?? 0)
  const basis =
    deadGrams === null ? null : volumetric && volumetric.grams > deadGrams ? 'volumetric' : 'dead'
  return {
    deadGrams,
    volumetric,
    billedGrams,
    basis,
    courierGrams: courierGrams !== null && courierGrams !== billedGrams ? courierGrams : null,
  }
}

/**
 * The calculation for one row as the merchant pays for it (`insuredRows`' output when
 * `insured`): the weight, the courier's lines (or its single total), the insurance worked out,
 * and the total, which is the row's price. Null for a row with no price or one that cannot
 * take the parcel.
 */
export function priceCalculation(
  row: CourierRateRow,
  opts: {
    insured: boolean
    parcel?: ParcelSize | null | undefined
    chargedGrams?: number | null | undefined
  },
): PriceCalculation | null {
  if (row.pricePaise === null || row.problem !== null) return null
  const state = rowInsuranceState(row, opts.insured)
  const added = state.kind === 'added' ? state : null
  // `insuredRows` put the insurance on top of the courier's own price; take it back off.
  const courierPaise = row.pricePaise - (added?.pricePaise ?? 0)
  const charges = [...row.charges].sort(
    (a, b) => CHARGE_ORDER.indexOf(a.kind) - CHARGE_ORDER.indexOf(b.kind),
  )
  const lines: CalculationLine[] = []
  if (charges.length === 0) {
    lines.push({ kind: 'courierTotal', paise: courierPaise })
  } else {
    for (const c of charges) lines.push({ kind: 'charge', charge: c.kind, paise: c.pricePaise })
    const gap = courierPaise - charges.reduce((sum, c) => sum + c.pricePaise, 0)
    if (gap !== 0) {
      lines.push({
        kind: Math.abs(gap) <= ROUNDING_LIMIT_PAISE ? 'rounding' : 'unitemised',
        paise: gap,
      })
    }
  }
  if (added) {
    const value = row.cover ? coverNotes(row, opts.insured, 0).valuePaise : null
    lines.push({
      kind: 'insuranceFee',
      paise: added.feePaise,
      rateBps: added.rateBps,
      valuePaise: value,
      gstIncluded: added.gstIncluded,
      estimate: added.estimate,
    })
    if (!added.gstIncluded) {
      lines.push({
        kind: 'insuranceGst',
        paise: added.gstPaise,
        gstBps: INSURANCE_GST_BPS,
        estimate: added.estimate,
      })
    }
  }
  return {
    weight: weightCalculation(opts.parcel, row.chargeableWeightGrams, opts.chargedGrams ?? null),
    lines,
    insurance: state.kind,
    totalPaise: row.pricePaise,
  }
}

/**
 * The Create shipment summary's three rows (Figma 898:7376): Freight (every courier line but
 * GST, or the courier's single total), Insurance (fee, GST apart) and GST (the courier's and the
 * insurance's). Null where the row has nothing; the three always add up to the total.
 */
export function summaryParts(calc: PriceCalculation): {
  freightPaise: number
  insurancePaise: number | null
  gstPaise: number | null
} {
  let freight = 0
  let insurance: number | null = null
  let gst: number | null = null
  for (const line of calc.lines) {
    if ((line.kind === 'charge' && line.charge === 'gst') || line.kind === 'insuranceGst') {
      gst = (gst ?? 0) + line.paise
    } else if (line.kind === 'insuranceFee') {
      insurance = (insurance ?? 0) + line.paise
    } else {
      freight += line.paise
    }
  }
  return { freightPaise: freight, insurancePaise: insurance, gstPaise: gst }
}
