import { allocatePaise, type GstRateRow, sameState, splitByRate } from '@commerce/core/gst'
import {
  type DocumentKind,
  type DocumentLine,
  type DocumentSnapshot,
  type DocumentTotals,
  type ExportSupply,
  type HsnRow,
  OUTSIDE_INDIA,
  type Party,
  type Place,
  type TaxRow,
} from './snapshot'
import { amountInWords } from './words'

export type SourceLine = {
  title: string | null
  variantTitle: string | null
  sku: string | null
  quantity: number
  unitPricePaise: number
  /** Snapshot on the order line, else the variant's; null uses the default HSN. */
  hsn: string | null
  /** Rate charged at checkout; null on older orders, which use the fallback rate. */
  ratePercent: number | null
  /** The order line itself, recorded on the invoice line for credit notes on returns. */
  orderLineId?: string | null | undefined
}

export type SourceOrder = {
  id: string
  number: number
  placedAt: Date
  paymentMethod: string | null
  /** Still to be collected on delivery (cash on delivery); 0 when prepaid. */
  collectPaise: number
  shippingPaise: number
  discountPaise: number
  paymentAdjustmentPaise: number
  paymentAdjustmentLabel: string | null
  /** What the shipping is ("Bluedart"), printed beside "Shipping charges". */
  shippingLabel?: string | null | undefined
  /** What the discount is for ("UPI discount"), printed beside the discount total. */
  discountLabel?: string | null | undefined
  totalPaise: number
  /** `order.tax_breakdown` as stored; read defensively since older rows lack `byRate`. */
  taxBreakdown: unknown
}

export type BuildDocumentInput = {
  kind: DocumentKind
  number: string | null
  issuedAt: Date
  order: SourceOrder
  lines: SourceLine[]
  seller: Party
  buyer: Party
  shipTo: Party | null
  placeOfSupply: Place | null
  defaultHsn: string
  hsnDigits: 4 | 6 | 8
  /** Store default rate, for lines on orders placed before rates were recorded. */
  fallbackRatePercent: number
  /** Goods shipped outside India: zero-rated, place of supply 96 (Other Country). */
  exportSupply?: ExportSupply | null | undefined
  /** The seller is on the composition scheme: a bill of supply with its rule 5(1)(g) note. */
  composition?: boolean | undefined
}

type Recorded = {
  ratePercent: number
  interState: boolean
  byRate: GstRateRow[] | null
}

/** The breakdown saved at checkout, if it has the shape we need. */
function recordedGst(raw: unknown): Recorded | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (typeof r.ratePercent !== 'number' || typeof r.interState !== 'boolean') return null
  const byRate = Array.isArray(r.byRate) ? (r.byRate as GstRateRow[]) : null
  return { ratePercent: r.ratePercent, interState: r.interState, byRate }
}

function lineDescription(l: SourceLine): string {
  const title = l.title?.trim() || 'Item'
  const variant = l.variantTitle?.trim()
  return variant && variant !== 'Default' && variant !== 'Default Title'
    ? `${title} / ${variant}`
    : title
}

/** Digits only, cut to the length the seller's turnover requires. */
export function hsnFor(raw: string | null, fallback: string, digits: number): string {
  const code = (raw ?? '').replace(/\D/g, '') || fallback.replace(/\D/g, '')
  return code ? code.slice(0, digits) : ''
}

type Draft = Omit<
  DocumentLine,
  'taxablePaise' | 'cgstPaise' | 'sgstPaise' | 'igstPaise' | 'totalPaise'
> & { netPaise: number }

type Group = {
  ratePercent: number
  amountPaise: number
  taxPaise: number
  sgstPaise: number
}

/**
 * The document for an order, reconciled to the paisa with what the shopper
 * was charged. Prices are tax inclusive, so tax is extracted from each line
 * rather than added to it.
 *
 * Lines may carry different rates. The order total is split by rate the same
 * way checkout split it (`splitByRate`): reductions spread over goods by
 * value, shipping and a payment fee follow the principal supply. When the
 * order recorded that split, its amounts and taxes are used as they are, so
 * the invoice's tax columns always equal the GST charged.
 */
export function buildDocument(input: BuildDocumentInput): DocumentSnapshot {
  const { order } = input
  const goods = input.lines.filter((l) => l.quantity > 0)
  const recorded = recordedGst(order.taxBreakdown)
  const fallbackRate = recorded?.ratePercent ?? input.fallbackRatePercent
  const rateOf = (l: SourceLine) => Math.max(0, l.ratePercent ?? fallbackRate)
  const grosses = goods.map((l) => l.quantity * l.unitPricePaise)
  const reduction = order.discountPaise + Math.max(0, -order.paymentAdjustmentPaise)
  const split = splitByRate({
    lines: goods.map((l, i) => ({ grossPaise: grosses[i] ?? 0, ratePercent: rateOf(l) })),
    totalPaise: order.totalPaise,
    reductionPaise: reduction,
  })
  const exp = input.exportSupply ?? null
  const interState =
    exp !== null ||
    (recorded?.interState ??
      !sameState(input.placeOfSupply?.code ?? null, input.seller.state?.code ?? null))

  // Under LUT the whole amount is the taxable value and no IGST is charged.
  const groups = groupsFor(split.rates, split.amounts, recorded, interState, order.totalPaise).map(
    (g) => (exp?.mode === 'lut' ? { ...g, taxPaise: 0, sgstPaise: 0 } : g),
  )

  const principalIndex = goods.findIndex((l) => rateOf(l) === split.principalRate)
  const principalHsn = hsnFor(goods[principalIndex]?.hsn ?? null, input.defaultHsn, input.hsnDigits)
  const charges: Draft[] = []
  const charge = (description: string, amount: number) =>
    charges.push({
      description,
      sku: null,
      hsn: principalHsn,
      quantity: 1,
      unit: 'NOS',
      unitPricePaise: amount,
      grossPaise: amount,
      discountPaise: 0,
      ratePercent: split.principalRate,
      charge: true,
      netPaise: amount,
    })
  if (order.shippingPaise > 0) {
    const label = order.shippingLabel?.trim()
    charge(label ? `Shipping charges (${label})` : 'Shipping charges', order.shippingPaise)
  }
  if (order.paymentAdjustmentPaise > 0) {
    charge(order.paymentAdjustmentLabel || 'Payment fee', order.paymentAdjustmentPaise)
  }
  const chargeTotal = charges.reduce((a, c) => a + c.netPaise, 0)

  // Within each rate, whatever the group's amount does not cover of its goods
  // (and, for the principal, its charges) is that group's share of the discount.
  const goodsDrafts: Draft[] = goods.map((l, i) => ({
    description: lineDescription(l),
    sku: l.sku?.trim() || null,
    hsn: hsnFor(l.hsn, input.defaultHsn, input.hsnDigits),
    quantity: l.quantity,
    unit: 'NOS',
    unitPricePaise: l.unitPricePaise,
    grossPaise: grosses[i] ?? 0,
    discountPaise: 0,
    ratePercent: rateOf(l),
    charge: false,
    netPaise: grosses[i] ?? 0,
    ...(l.orderLineId ? { orderLineId: l.orderLineId } : {}),
  }))
  for (const g of groups) {
    const members = goodsDrafts.filter((d) => d.ratePercent === g.ratePercent)
    const memberGross = members.reduce((a, d) => a + d.grossPaise, 0)
    const own = g.amountPaise - (g.ratePercent === split.principalRate ? chargeTotal : 0)
    const cut = memberGross - own
    if (cut >= 0) {
      const cuts = allocatePaise(
        Math.min(cut, memberGross),
        members.map((d) => d.grossPaise),
      )
      members.forEach((d, i) => {
        d.discountPaise = cuts[i] ?? 0
        d.netPaise = d.grossPaise - d.discountPaise
      })
    } else {
      // More was charged at this rate than its goods: rounding on an older
      // order. It lands on the group's last line so the total still matches.
      const last = members.at(-1) ?? charges.at(-1)
      if (last) {
        last.grossPaise -= cut
        last.netPaise -= cut
        if (last.quantity === 1) last.unitPricePaise -= cut
      }
    }
  }

  const drafts = [...goodsDrafts, ...charges]
  const lines: DocumentLine[] = drafts.map(({ netPaise, ...d }) => ({
    ...d,
    taxablePaise: netPaise,
    cgstPaise: 0,
    sgstPaise: 0,
    igstPaise: 0,
    totalPaise: netPaise,
  }))
  for (const g of groups) {
    const idx = lines.flatMap((l, i) => (l.ratePercent === g.ratePercent ? [i] : []))
    applyTax(
      idx.map((i) => lines[i] as DocumentLine),
      g.taxPaise,
      g.sgstPaise,
      interState,
    )
  }

  const totals = totalsOf(lines)
  return {
    version: 1,
    kind: input.kind,
    number: input.number,
    issuedAt: input.issuedAt.toISOString(),
    order: {
      id: order.id,
      name: `#${order.number}`,
      placedAt: order.placedAt.toISOString(),
      paymentMethod: order.paymentMethod,
      collectPaise: order.collectPaise,
    },
    advance: null,
    original: null,
    reason: null,
    discountLabel: order.discountLabel?.trim() || null,
    seller: input.seller,
    buyer: input.buyer,
    shipTo: input.shipTo,
    placeOfSupply: exp ? { ...OUTSIDE_INDIA } : input.placeOfSupply,
    interState,
    reverseCharge: false,
    exportSupply: exp,
    composition: input.composition ?? false,
    lines,
    taxSummary: summariseByRate(lines),
    hsnSummary: summariseByHsn(lines),
    totals,
    amountInWords: amountInWords(totals.totalPaise),
    einvoice: null,
  }
}

/** Each rate's amount and tax: as recorded at checkout when it lines up, else computed now. */
function groupsFor(
  rates: number[],
  amounts: number[],
  recorded: Recorded | null,
  interState: boolean,
  totalPaise: number,
): Group[] {
  const taxedRates = rates.filter((r) => r > 0)
  const byRate = recorded?.byRate
  const matches =
    byRate &&
    byRate.length === taxedRates.length &&
    byRate.every((row) => taxedRates.includes(row.ratePercent)) &&
    byRate.reduce((a, r) => a + r.amountPaise, 0) +
      rates.reduce((a, r, i) => (r > 0 ? a : a + (amounts[i] ?? 0)), 0) ===
      totalPaise
  return rates.map((ratePercent, i) => {
    const row = matches ? byRate.find((r) => r.ratePercent === ratePercent) : undefined
    if (row) {
      return {
        ratePercent,
        amountPaise: row.amountPaise,
        taxPaise: row.taxPaise,
        sgstPaise: row.sgstPaise,
      }
    }
    const amountPaise = amounts[i] ?? 0
    const taxPaise = inclusiveTax(amountPaise, ratePercent)
    return {
      ratePercent,
      amountPaise,
      taxPaise,
      sgstPaise: interState ? 0 : Math.floor(taxPaise / 2),
    }
  })
}

/** Tax inside a tax-inclusive amount, as checkout computes it. */
export const inclusiveTax = (amountPaise: number, ratePercent: number) =>
  amountPaise > 0 && ratePercent > 0
    ? Math.round((amountPaise * ratePercent) / (100 + ratePercent))
    : 0

/** Spread one rate's tax over its lines by value, as CGST + SGST or IGST. */
export function applyTax(
  lines: DocumentLine[],
  taxPaise: number,
  sgstPaise: number,
  inter: boolean,
) {
  const taxes = allocatePaise(
    taxPaise,
    lines.map((l) => l.totalPaise),
  )
  const sgsts = inter ? lines.map(() => 0) : allocatePaise(sgstPaise, taxes)
  lines.forEach((l, i) => {
    const tax = taxes[i] ?? 0
    const sgst = sgsts[i] ?? 0
    l.taxablePaise = l.totalPaise - tax
    l.igstPaise = inter ? tax : 0
    l.sgstPaise = sgst
    l.cgstPaise = inter ? 0 : tax - sgst
  })
}

export function totalsOf(lines: readonly DocumentLine[]): DocumentTotals {
  const sum = (pick: (l: DocumentLine) => number) => lines.reduce((a, l) => a + pick(l), 0)
  const cgstPaise = sum((l) => l.cgstPaise)
  const sgstPaise = sum((l) => l.sgstPaise)
  const igstPaise = sum((l) => l.igstPaise)
  return {
    grossPaise: sum((l) => l.grossPaise),
    discountPaise: sum((l) => l.discountPaise),
    taxablePaise: sum((l) => l.taxablePaise),
    cgstPaise,
    sgstPaise,
    igstPaise,
    taxPaise: cgstPaise + sgstPaise + igstPaise,
    totalPaise: sum((l) => l.totalPaise),
  }
}

export function summariseByRate(lines: readonly DocumentLine[]): TaxRow[] {
  const rows = new Map<number, TaxRow>()
  for (const l of lines) {
    const row = rows.get(l.ratePercent) ?? {
      ratePercent: l.ratePercent,
      taxablePaise: 0,
      cgstPaise: 0,
      sgstPaise: 0,
      igstPaise: 0,
    }
    row.taxablePaise += l.taxablePaise
    row.cgstPaise += l.cgstPaise
    row.sgstPaise += l.sgstPaise
    row.igstPaise += l.igstPaise
    rows.set(l.ratePercent, row)
  }
  return [...rows.values()].sort((a, b) => a.ratePercent - b.ratePercent)
}

export function summariseByHsn(lines: readonly DocumentLine[]): HsnRow[] {
  const rows = new Map<string, HsnRow>()
  for (const l of lines) {
    const key = `${l.hsn}|${l.ratePercent}`
    const row = rows.get(key) ?? {
      hsn: l.hsn,
      ratePercent: l.ratePercent,
      quantity: 0,
      taxablePaise: 0,
      cgstPaise: 0,
      sgstPaise: 0,
      igstPaise: 0,
    }
    // Shipping and fees ride on the goods' HSN for value but are not units sold.
    if (!l.charge) row.quantity += l.quantity
    row.taxablePaise += l.taxablePaise
    row.cgstPaise += l.cgstPaise
    row.sgstPaise += l.sgstPaise
    row.igstPaise += l.igstPaise
    rows.set(key, row)
  }
  return [...rows.values()].sort(
    (a, b) => a.hsn.localeCompare(b.hsn) || a.ratePercent - b.ratePercent,
  )
}

export type VoucherInput = {
  /** The order as a document (any kind); only its parties and order block are kept. */
  base: DocumentSnapshot
  kind: 'receipt_voucher' | 'refund_voucher'
  number: string
  issuedAt: Date
  amountPaise: number
  /** For a refund voucher, the receipt voucher it returns money against. */
  original?: { number: string; issuedAt: string } | undefined
  reason?: string | null | undefined
}

/**
 * Receipt voucher (rule 50) for an advance on goods, or refund voucher
 * (rule 51) returning it. GST on goods is due at supply, not on advances
 * (Notification 66/2017-Central Tax), so both carry no tax: one line for the
 * amount, rate 0.
 */
export function buildVoucher(input: VoucherInput): DocumentSnapshot {
  const hsn = input.base.lines.find((l) => !l.charge)?.hsn ?? ''
  const line: DocumentLine = {
    description:
      input.kind === 'receipt_voucher'
        ? `Advance received for order ${input.base.order.name}`
        : `Advance refunded for order ${input.base.order.name}`,
    sku: null,
    hsn,
    quantity: 1,
    unit: 'NOS',
    unitPricePaise: input.amountPaise,
    grossPaise: input.amountPaise,
    discountPaise: 0,
    taxablePaise: input.amountPaise,
    ratePercent: 0,
    cgstPaise: 0,
    sgstPaise: 0,
    igstPaise: 0,
    totalPaise: input.amountPaise,
    charge: false,
  }
  const lines = [line]
  const totals = totalsOf(lines)
  return {
    ...input.base,
    kind: input.kind,
    number: input.number,
    issuedAt: input.issuedAt.toISOString(),
    order: { ...input.base.order, collectPaise: 0 },
    advance: null,
    original: input.original ?? null,
    reason: input.reason ?? null,
    lines,
    taxSummary: [],
    hsnSummary: summariseByHsn(lines),
    totals,
    amountInWords: amountInWords(totals.totalPaise),
    einvoice: null,
  }
}
