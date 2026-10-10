/** SOURCE OF TRUTH: landed cost, FX to paise, charge splits, weighted average cost (WAC),
 * revaluation, purchase currencies, charge kinds, split methods, inbound shipment statuses
 * — WHAT: the pure maths that turns a purchase order's goods and charges into a landed cost
 * per unit, and a receipt or a late charge into the variant's weighted average cost.
 * WHY: one place for money rounding on purchases, shared by the services, the preview the
 * admin shows before receiving, and tests. No database here, so client components may
 * import it through `@commerce/core/inventory`.
 *
 * Rounding: every division rounds half up, away from zero for negative amounts (2.5 → 3,
 * -2.5 → -3), in integer paise using BigInt so no step goes through a float. A charge's
 * splits use the largest remainder method, so they always add up to the charge exactly.
 */

/** Currencies a purchase can be priced in, with their minor-unit digits (ISO 4217). */
const PURCHASE_CURRENCIES = {
  INR: 2,
  USD: 2,
  EUR: 2,
  GBP: 2,
  CNY: 2,
  AED: 2,
  HKD: 2,
  SGD: 2,
  JPY: 0,
} as const
export type PurchaseCurrency = keyof typeof PURCHASE_CURRENCIES
export const PURCHASE_CURRENCY_CODES = Object.keys(PURCHASE_CURRENCIES) as PurchaseCurrency[]

/** Same values as `purchase_charge.kind` (packages/db purchasing-schema). */
export const PURCHASE_CHARGE_KINDS = [
  'goods_adjustment',
  'freight_insurance',
  'customs_bcd',
  'customs_sws',
  'customs_igst',
  'cha_fee',
  'port_handling',
  'freight_local',
  'bank_fx',
  'other',
] as const
export type PurchaseChargeKind = (typeof PURCHASE_CHARGE_KINDS)[number]

/** Same values as `purchase_charge.split_method`. */
export const SPLIT_METHODS = [
  'by_weight',
  'by_value',
  'by_quantity',
  'specific_lines',
  'manual',
] as const
export type SplitMethod = (typeof SPLIT_METHODS)[number]

/** Same values as `inbound_shipment.status`, in order. */
export const INBOUND_SHIPMENT_STATUSES = ['in_transit', 'at_port', 'cleared', 'delivered'] as const
export type InboundShipmentStatus = (typeof INBOUND_SHIPMENT_STATUSES)[number]

/** Freight and insurance follow weight; everything else follows value until changed. */
export function defaultSplitMethod(kind: PurchaseChargeKind): SplitMethod {
  return kind === 'freight_insurance' ? 'by_weight' : 'by_value'
}

/** IGST paid at customs comes back as input credit; every other charge is cost by default. */
export function defaultRecoverable(kind: PurchaseChargeKind): boolean {
  return kind === 'customs_igst'
}

/** `num / den` rounded half away from zero. `den` must be positive. */
export function divRound(num: bigint, den: bigint): bigint {
  if (den <= 0n) throw new RangeError('divRound needs a positive divisor')
  if (num >= 0n) return (2n * num + den) / (2n * den)
  return -((-2n * num + den) / (2n * den))
}

const FX_RE = /^\d{1,9}(\.\d{1,6})?$/

/** "83.25" as millionths of a rupee per unit of the currency (83_250_000n); null if invalid or zero. */
export function parseFxRate(text: string): bigint | null {
  const t = text.trim()
  if (!FX_RE.test(t)) return null
  const [whole = '0', frac = ''] = t.split('.')
  const micro = BigInt(whole) * 1_000_000n + BigInt(frac.padEnd(6, '0'))
  return micro > 0n ? micro : null
}

/** Minor-unit digits of a purchase currency (2 when unknown). */
export function currencyDigits(currency: string): number {
  return (PURCHASE_CURRENCIES as Record<string, number>)[currency] ?? 2
}

/**
 * An amount in a currency's minor units (cents, fen, yen) as INR paise at `fxRate` (INR per
 * one major unit). INR passes through untouched whatever the rate says.
 */
export function convertToPaise(amountMinor: number, currency: string, fxRate: string): number {
  if (currency === 'INR') return amountMinor
  const micro = parseFxRate(fxRate)
  if (micro === null) throw new RangeError(`Invalid exchange rate "${fxRate}"`)
  const den = 10n ** BigInt(currencyDigits(currency)) * 1_000_000n
  return Number(divRound(BigInt(amountMinor) * micro * 100n, den))
}

const AMOUNT_RE = /^(-)?(\d*)(?:\.(\d*))?$/

/**
 * Typed text ("1,200.5", "-30") as minor units of `currency`, without a float in between.
 * Null when it is not a plain amount, has more decimals than the currency, or is negative
 * and `allowNegative` is off.
 */
export function parseAmountMinor(
  text: string,
  currency: string,
  allowNegative = false,
): number | null {
  const m = AMOUNT_RE.exec(text.trim().replaceAll(',', ''))
  if (!m) return null
  const [, sign, whole = '', frac = ''] = m
  const digits = currencyDigits(currency)
  if (whole === '' && frac === '') return null
  if (frac.length > digits || (sign && !allowNegative)) return null
  const minor =
    BigInt(whole || '0') * 10n ** BigInt(digits) + BigInt(frac.padEnd(digits, '0') || '0')
  const n = Number(sign ? -minor : minor)
  return Number.isSafeInteger(n) ? n : null
}

/** Minor units as plain text for an input ("1200.5" for 120050 cents); empty for 0. */
export function minorToText(minor: number, currency: string): string {
  if (minor === 0) return ''
  const digits = currencyDigits(currency)
  const sign = minor < 0 ? '-' : ''
  const abs = String(Math.abs(minor)).padStart(digits + 1, '0')
  const whole = digits ? abs.slice(0, -digits) : abs
  const frac = digits ? abs.slice(-digits).replace(/0+$/, '') : ''
  return `${sign}${whole}${frac ? `.${frac}` : ''}`
}

/**
 * Split `total` paise in proportion to `weights` (each ≥ 0, at least one > 0) so the parts
 * sum to `total` exactly: everyone gets the floor of their share, then the paise left over go
 * one each to the largest remainders (earlier lines first on a tie). A negative total (a
 * supplier credit) is split as its absolute value and negated.
 */
export function allocate(total: number, weights: readonly number[]): number[] {
  if (total < 0) return allocate(-total, weights).map((n) => (n === 0 ? 0 : -n))
  const w = weights.map((x) => BigInt(Math.max(0, Math.round(x))))
  const sum = w.reduce((a, b) => a + b, 0n)
  if (sum === 0n) throw new RangeError('allocate needs at least one positive weight')
  const t = BigInt(total)
  const parts = w.map((x) => (t * x) / sum)
  const rems = w.map((x, i) => ({ i, r: (t * x) % sum }))
  let left = Number(t - parts.reduce((a, b) => a + b, 0n))
  rems.sort((a, b) => (a.r === b.r ? a.i - b.i : a.r > b.r ? -1 : 1))
  for (const { i } of rems) {
    if (left === 0) break
    parts[i] = (parts[i] ?? 0n) + 1n
    left -= 1
  }
  return parts.map(Number)
}

export type CostLine = {
  id: string
  quantity: number
  /** quantity × unit price, converted to paise. */
  goodsPaise: number
  /** Weight of one unit; null or 0 when the variant has none. */
  weightGrams: number | null
}

export type ManualSplitInput = { lineId: string; amountPaise: number }

export type CostCharge = {
  id: string
  amountPaise: number
  recoverable: boolean
  splitMethod: SplitMethod
  /** Lines this charge can land on: its purchase order's, or every line in its shipment. */
  lineIds: readonly string[]
  splitLineIds?: readonly string[] | null
  manualSplits?: readonly ManualSplitInput[] | null
}

export type CostWarning =
  /** By weight, but these lines have no weight: the charge was split by value instead. */
  | { code: 'missing_weight'; chargeId: string; lineIds: string[] }
  /** Manual amounts do not add up to the charge (or name a line it cannot reach): split by value. */
  | { code: 'manual_mismatch'; chargeId: string; expectedPaise: number; gotPaise: number }
  /** Specific lines, but none of them is on this order or shipment any more: split by value. */
  | { code: 'no_selected_lines'; chargeId: string }
  /** Every line is worth 0 (or weighs 0): split by quantity. */
  | { code: 'zero_basis'; chargeId: string }
  /** Nothing to split onto (a shipment with no orders yet): this charge is in no cost. */
  | { code: 'no_lines'; chargeId: string }

export type ChargeSplit = { lineId: string; amountPaise: number }

export type ChargeAllocation = {
  chargeId: string
  /** The method actually used, after any fallback. */
  method: SplitMethod
  splits: ChargeSplit[]
}

export type LineCost = {
  lineId: string
  goodsPaise: number
  /** This line's share of charges that are product cost. */
  chargesPaise: number
  /** This line's share of recoverable charges (IGST): tracked, never cost. */
  recoverablePaise: number
  landedTotalPaise: number
  /** landedTotal ÷ quantity, rounded half up; never below 0. */
  landedUnitPaise: number
}

export type LandedCosts = {
  lines: LineCost[]
  charges: ChargeAllocation[]
  warnings: CostWarning[]
}

function basis(method: 'by_weight' | 'by_value' | 'by_quantity', lines: CostLine[]): number[] {
  if (method === 'by_weight') return lines.map((l) => (l.weightGrams ?? 0) * l.quantity)
  if (method === 'by_quantity') return lines.map((l) => l.quantity)
  return lines.map((l) => l.goodsPaise)
}

const hasWeight = (l: CostLine) => l.weightGrams !== null && l.weightGrams > 0

/** Split one charge across the lines it can reach, falling back (with a warning) where it must. */
function splitCharge(
  charge: CostCharge,
  all: CostLine[],
  warnings: CostWarning[],
): ChargeAllocation {
  const reach = new Set(charge.lineIds)
  const lines = all.filter((l) => reach.has(l.id))
  if (lines.length === 0) {
    warnings.push({ code: 'no_lines', chargeId: charge.id })
    return { chargeId: charge.id, method: charge.splitMethod, splits: [] }
  }

  if (charge.splitMethod === 'manual') {
    const given = charge.manualSplits ?? []
    const got = given.reduce((n, s) => n + s.amountPaise, 0)
    const fits = given.every((s) => reach.has(s.lineId))
    if (fits && got === charge.amountPaise) {
      const by = new Map(given.map((s) => [s.lineId, s.amountPaise]))
      return {
        chargeId: charge.id,
        method: 'manual',
        splits: lines.map((l) => ({ lineId: l.id, amountPaise: by.get(l.id) ?? 0 })),
      }
    }
    warnings.push({
      code: 'manual_mismatch',
      chargeId: charge.id,
      expectedPaise: charge.amountPaise,
      gotPaise: got,
    })
    return byBasis(charge, lines, 'by_value', warnings)
  }

  if (charge.splitMethod === 'specific_lines') {
    const picked = new Set(charge.splitLineIds ?? [])
    const chosen = lines.filter((l) => picked.has(l.id))
    if (chosen.length === 0) {
      warnings.push({ code: 'no_selected_lines', chargeId: charge.id })
      return byBasis(charge, lines, 'by_value', warnings)
    }
    const alloc = byBasis(charge, chosen, 'by_value', warnings)
    const by = new Map(alloc.splits.map((s) => [s.lineId, s.amountPaise]))
    return {
      chargeId: charge.id,
      method: 'specific_lines',
      splits: lines.map((l) => ({ lineId: l.id, amountPaise: by.get(l.id) ?? 0 })),
    }
  }

  if (charge.splitMethod === 'by_weight') {
    const missing = lines.filter((l) => !hasWeight(l)).map((l) => l.id)
    if (missing.length > 0) {
      warnings.push({ code: 'missing_weight', chargeId: charge.id, lineIds: missing })
      return byBasis(charge, lines, 'by_value', warnings)
    }
  }
  return byBasis(charge, lines, charge.splitMethod, warnings)
}

function byBasis(
  charge: CostCharge,
  lines: CostLine[],
  method: 'by_weight' | 'by_value' | 'by_quantity',
  warnings: CostWarning[],
): ChargeAllocation {
  let weights = basis(method, lines)
  let used: SplitMethod = method
  if (weights.every((w) => w <= 0)) {
    warnings.push({ code: 'zero_basis', chargeId: charge.id })
    weights = basis('by_quantity', lines)
    used = 'by_quantity'
  }
  const parts = allocate(charge.amountPaise, weights)
  return {
    chargeId: charge.id,
    method: used,
    splits: lines.map((l, i) => ({ lineId: l.id, amountPaise: parts[i] ?? 0 })),
  }
}

/**
 * Split every charge across its lines and add each line's share of the non-recoverable ones
 * to its goods: landed unit cost = (goods + charges) ÷ quantity. Pure; the services persist it.
 */
export function computeLandedCosts(
  lines: readonly CostLine[],
  charges: readonly CostCharge[],
): LandedCosts {
  const warnings: CostWarning[] = []
  const all = [...lines]
  const allocations = charges.map((c) => splitCharge(c, all, warnings))
  const cost = new Map(lines.map((l) => [l.id, 0]))
  const recoverable = new Map(lines.map((l) => [l.id, 0]))
  charges.forEach((c, i) => {
    const target = c.recoverable ? recoverable : cost
    for (const s of allocations[i]?.splits ?? []) {
      target.set(s.lineId, (target.get(s.lineId) ?? 0) + s.amountPaise)
    }
  })
  return {
    lines: lines.map((l) => {
      const chargesPaise = cost.get(l.id) ?? 0
      const landedTotalPaise = l.goodsPaise + chargesPaise
      const unit = l.quantity > 0 ? divRound(BigInt(landedTotalPaise), BigInt(l.quantity)) : 0n
      return {
        lineId: l.id,
        goodsPaise: l.goodsPaise,
        chargesPaise,
        recoverablePaise: recoverable.get(l.id) ?? 0,
        landedTotalPaise,
        landedUnitPaise: Math.max(0, Number(unit)),
      }
    }),
    charges: allocations,
    warnings,
  }
}

/**
 * The variant's cost after a receipt, weighted by units: (on hand × old cost + received ×
 * landed) ÷ (on hand + received). With nothing (or less than nothing) on hand before, or no
 * known cost, the landed cost simply becomes the cost.
 */
export function weightedAverageCost(input: {
  onHandBefore: number
  costBefore: number | null
  receivedQty: number
  landedUnitPaise: number
}): number {
  const { onHandBefore, costBefore, receivedQty, landedUnitPaise } = input
  if (receivedQty <= 0) return costBefore ?? landedUnitPaise
  if (onHandBefore <= 0 || costBefore === null) return landedUnitPaise
  const value =
    BigInt(onHandBefore) * BigInt(costBefore) + BigInt(receivedQty) * BigInt(landedUnitPaise)
  return Number(divRound(value, BigInt(onHandBefore + receivedQty)))
}

/**
 * A late change to what `units` received units cost, by `deltaPaise` in total. Only the
 * share still on hand (at most `units` of the `onHand` now) moves the average; units already
 * sold keep the cost they went out at. Returns the new cost and the paise applied to stock.
 */
export function revaluedCost(input: {
  onHand: number
  cost: number | null
  deltaPaise: number
  units: number
}): { cost: number | null; appliedPaise: number } {
  const { onHand, cost, deltaPaise, units } = input
  if (deltaPaise === 0 || units <= 0 || onHand <= 0 || cost === null) {
    return { cost, appliedPaise: 0 }
  }
  const covered = BigInt(Math.min(onHand, units))
  const applied = divRound(BigInt(deltaPaise) * covered, BigInt(units))
  const next = divRound(BigInt(onHand) * BigInt(cost) + applied, BigInt(onHand))
  return { cost: Math.max(0, Number(next)), appliedPaise: Number(applied) }
}
