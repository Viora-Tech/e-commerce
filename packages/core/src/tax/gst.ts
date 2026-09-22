import { sameState } from './states'

export { sameState }

export type GstBreakdown = {
  /** Total tax already contained in the amount charged. */
  taxPaise: number
  cgstPaise: number
  sgstPaise: number
  igstPaise: number
  ratePercent: number
  /** False when buyer and seller are in the same state (CGST + SGST). */
  interState: boolean
}

export const emptyGst: GstBreakdown = {
  taxPaise: 0,
  cgstPaise: 0,
  sgstPaise: 0,
  igstPaise: 0,
  ratePercent: 0,
  interState: false,
}

/**
 * Indian retail prices include GST ("inclusive of all taxes"), so tax is
 * extracted from what the shopper paid rather than added to it. The total is
 * never changed by this function.
 *
 * Within a state the tax splits in half between centre and state (CGST/SGST);
 * across states it is one IGST line. The halves are split so they always add
 * back to `taxPaise` exactly, with the odd paisa going to CGST.
 */
export function computeGst(input: {
  /** Amount actually charged for taxable goods, tax included. */
  amountPaise: number
  ratePercent: number
  /** Where the parcel goes; a code or a full state name. */
  shipToState: string | null | undefined
  /** Where the business is registered; a code or a full state name. */
  storeState: string | null | undefined
}): GstBreakdown {
  const { amountPaise, ratePercent } = input
  if (amountPaise <= 0 || ratePercent <= 0)
    return { ...emptyGst, ratePercent: Math.max(0, ratePercent) }

  const taxPaise = Math.round((amountPaise * ratePercent) / (100 + ratePercent))
  /* Unknown store or shipping state cannot be proven to be the same one, and
     IGST is the safer default: it is a single line the merchant can correct. */
  const interState = !sameState(input.shipToState, input.storeState)
  if (interState) {
    return { taxPaise, cgstPaise: 0, sgstPaise: 0, igstPaise: taxPaise, ratePercent, interState }
  }
  const sgstPaise = Math.floor(taxPaise / 2)
  return {
    taxPaise,
    cgstPaise: taxPaise - sgstPaise,
    sgstPaise,
    igstPaise: 0,
    ratePercent,
    interState,
  }
}

/** Tax for one GST rate on an order. `taxablePaise` is the value net of the tax inside it. */
export type GstRateRow = {
  ratePercent: number
  /** Tax-inclusive amount charged for this rate's supplies. */
  amountPaise: number
  taxablePaise: number
  taxPaise: number
  cgstPaise: number
  sgstPaise: number
  igstPaise: number
}

/** A {@link GstBreakdown} that also records the split by rate when a cart mixes rates. */
export type OrderGst = GstBreakdown & { byRate: GstRateRow[] }

/**
 * Split `total` into integers proportional to `weights`, largest remainder
 * first, so the parts always add back to `total` exactly.
 */
export function allocatePaise(total: number, weights: readonly number[]): number[] {
  if (weights.length === 0) return []
  const sum = weights.reduce((a, w) => a + Math.max(0, w), 0)
  if (sum === 0) return weights.map((_, i) => (i === 0 ? total : 0))
  const exact = weights.map((w) => (Math.max(0, w) * total) / sum)
  const parts = exact.map((x) => Math.floor(x))
  let left = total - parts.reduce((a, b) => a + b, 0)
  const byRemainder = exact
    .map((x, i) => ({ i, frac: x - Math.floor(x) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i)
  for (const { i } of byRemainder) {
    if (left <= 0) break
    parts[i] = (parts[i] ?? 0) + 1
    left--
  }
  return parts
}

export type GstLineInput = {
  /** Tax-inclusive quantity × unit price, before order-level reductions. */
  grossPaise: number
  /** This line's GST rate: the variant's own, else the store default. */
  ratePercent: number
}

/** How an order's charged total divides between GST rates. */
export type RateSplit = {
  /** Distinct rates, ascending. */
  rates: number[]
  /** Tax-inclusive amount charged per rate, same order as `rates`; adds to the total. */
  amounts: number[]
  /** Order-level reduction taken off each input line, same order as the lines. */
  lineReductions: number[]
  /** Rate of the group with the largest value; shipping and fees follow it. */
  principalRate: number
  /** Shipping, fees and anything else charged beyond the goods, after reductions. */
  chargesPaise: number
}

/**
 * Split an order's charged total by GST rate. Order-level reductions (a
 * discount, a payment-method discount) are spread over the goods lines by
 * value. Charges that are part of the same supply (shipping, a payment fee)
 * follow the principal supply: the rate group with the largest value. The
 * invoice uses the same split, so its tax columns match the order to the
 * paisa.
 */
export function splitByRate(input: {
  lines: readonly GstLineInput[]
  totalPaise: number
  /** Order-level reductions; defaults to whatever the goods exceed the total by. */
  reductionPaise?: number | undefined
}): RateSplit {
  const grosses = input.lines.map((l) => Math.max(0, l.grossPaise))
  const lineRates = input.lines.map((l) => Math.max(0, l.ratePercent))
  const goods = grosses.reduce((a, b) => a + b, 0)
  const reduction = Math.min(
    goods,
    Math.max(0, input.reductionPaise ?? Math.max(0, goods - input.totalPaise)),
  )
  const lineReductions = allocatePaise(reduction, grosses)
  const chargesPaise = input.totalPaise - goods + reduction

  const rates = [...new Set(lineRates.filter((_, i) => (grosses[i] ?? 0) > 0))].sort(
    (a, b) => a - b,
  )
  if (rates.length === 0) rates.push(0)
  const groupGross = rates.map((r) =>
    grosses.reduce((a, g, i) => (lineRates[i] === r ? a + g : a), 0),
  )
  // Ties go to the higher rate so the principal is stable whatever the cart order.
  const principal = groupGross.lastIndexOf(Math.max(...groupGross))
  const amounts = rates.map((r, gi) => {
    const net = grosses.reduce(
      (a, g, i) => (lineRates[i] === r ? a + g - (lineReductions[i] ?? 0) : a),
      0,
    )
    return net + (gi === principal ? chargesPaise : 0)
  })
  return { rates, amounts, lineReductions, principalRate: rates[principal] ?? 0, chargesPaise }
}

/**
 * GST for a whole order when lines may carry different rates: each rate
 * group's tax is extracted from what was charged for it (see
 * {@link splitByRate}). With a single rate this is exactly {@link computeGst}
 * on the total.
 */
export function computeOrderGst(input: {
  lines: readonly GstLineInput[]
  totalPaise: number
  reductionPaise?: number | undefined
  shipToState: string | null | undefined
  storeState: string | null | undefined
}): OrderGst {
  const split = splitByRate(input)
  const rows = split.rates.map((ratePercent, i) =>
    rowOf(
      computeGst({
        amountPaise: split.amounts[i] ?? 0,
        ratePercent,
        shipToState: input.shipToState,
        storeState: input.storeState,
      }),
      split.amounts[i] ?? 0,
    ),
  )
  const taxed = rows.filter((r) => r.ratePercent > 0 || r.taxPaise > 0)
  const sum = (pick: (r: GstRateRow) => number) => rows.reduce((a, r) => a + pick(r), 0)
  return {
    taxPaise: sum((r) => r.taxPaise),
    cgstPaise: sum((r) => r.cgstPaise),
    sgstPaise: sum((r) => r.sgstPaise),
    igstPaise: sum((r) => r.igstPaise),
    ratePercent: split.principalRate,
    interState: !sameState(input.shipToState, input.storeState),
    byRate: taxed,
  }
}

function rowOf(g: GstBreakdown, amountPaise: number): GstRateRow {
  return {
    ratePercent: g.ratePercent,
    amountPaise,
    taxablePaise: amountPaise - g.taxPaise,
    taxPaise: g.taxPaise,
    cgstPaise: g.cgstPaise,
    sgstPaise: g.sgstPaise,
    igstPaise: g.igstPaise,
  }
}
