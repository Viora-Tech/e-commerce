import { LOW_CONFIDENCE } from '@commerce/ai/client'
import {
  type ApplyDocument,
  CHARGE_KIND_FOR_BILL,
  convertToPaise,
  type MatchMethod,
  type PurchaseChargeKind,
  type PurchaseCurrency,
  parseAmountMinor,
  parseFxRate,
  printedRate,
  printedToMinor,
  purchaseCurrencyOf,
} from '@commerce/core/inventory'
import type { api } from '@/lib/api-client'

export type DocumentReview = Awaited<ReturnType<typeof api.purchaseDocuments.review>>
type Extracted = NonNullable<DocumentReview['extracted']>
type Field<T> = { value: T | null; confidence: number }

/** What a document line is matched to: an order line, or a store product not on the order yet. */
export type LineTarget = {
  lineId: string | null
  variantId: string
  label: string
  sku: string | null
  imageUrl: string | null
}

export type ReviewLine = {
  index: number
  apply: boolean
  target: LineTarget | null
  method: MatchMethod
  description: string
  supplierSku: string
  quantity: string
  /** Supplier invoice: price per unit in the document currency, as typed. */
  unitPrice: string
  hsnCode: string
  /** Bill of Entry: rupees per duty, as typed. */
  duties: { assessable: string; bcd: string; sws: string; igst: string }
  unsure: boolean
}

export type ReviewCharge = {
  key: string
  apply: boolean
  kind: PurchaseChargeKind
  label: string
  amount: string
  currency: PurchaseCurrency
  fxRate: string
  /** GST in rupees, as typed. */
  gst: string
  /** Bill of Entry duty: take each line's printed amount (when every line is matched). */
  dutyColumn: 'bcd' | 'sws' | 'igst' | null
  payee: string
  note: string
  incurredAt: string | null
}

export type ReviewState = {
  shape: Extracted['shape']
  currency: PurchaseCurrency
  setRate: boolean
  fxRate: string
  /** Draft: write the ticked lines onto the order. Sent: add a goods adjustment instead. */
  writeLines: boolean
  saveBillOfEntry: boolean
  billOfEntry: { number: string; date: string; port: string }
  lines: ReviewLine[]
  charges: ReviewCharge[]
}

const text = (f: Field<string> | undefined) => f?.value?.trim() ?? ''
const num = (f: Field<number> | undefined) =>
  f?.value === null || f?.value === undefined ? '' : String(f.value)
const unsure = (fields: Field<unknown>[]) =>
  fields.some((f) => f.value !== null && f.confidence < LOW_CONFIDENCE)

export const variantName = (v: { productTitle: string; variantTitle: string }) =>
  v.variantTitle && v.variantTitle !== 'Default'
    ? `${v.productTitle} / ${v.variantTitle}`
    : v.productTitle

/** Every product a document line can be matched to, order lines first. */
export function targetsOf(review: DocumentReview): LineTarget[] {
  return [
    ...review.lines.map((l) => ({
      lineId: l.lineId,
      variantId: l.variantId,
      label: variantName(l),
      sku: l.sku,
      imageUrl: l.imageUrl,
    })),
    ...review.extraVariants.map((v) => ({
      lineId: null,
      variantId: v.variantId,
      label: variantName(v),
      sku: v.sku,
      imageUrl: v.imageUrl,
    })),
  ]
}

/** The document's own order (null for a shipment). */
export const ownOrder = (review: DocumentReview) =>
  review.document.purchaseOrderId
    ? (review.orders.find((o) => o.id === review.document.purchaseOrderId) ?? null)
    : null

export const isDraft = (review: DocumentReview) => ownOrder(review)?.status === 'draft'

function linesFrom(review: DocumentReview, extracted: Extracted): ReviewLine[] {
  if (extracted.shape === 'service_bill') return []
  const targets = targetsOf(review)
  return extracted.data.lines.map((l, index) => {
    const match = review.matches[index]
    const target = targets.find((t) => t.variantId === match?.variantId) ?? null
    const si = extracted.shape === 'supplier_invoice' ? extracted.data.lines[index] : undefined
    const be = extracted.shape === 'bill_of_entry' ? extracted.data.lines[index] : undefined
    return {
      index,
      apply: target !== null,
      target,
      method: match?.method ?? 'none',
      description: text(l.description),
      supplierSku: text(si?.supplierSku),
      quantity: num(l.quantity),
      unitPrice: num(si?.unitPrice),
      hsnCode: text(l.hsnCode).replace(/\D/g, ''),
      duties: {
        assessable: num(be?.assessableValue),
        bcd: num(be?.bcd),
        sws: num(be?.sws),
        igst: num(be?.igst),
      },
      unsure: unsure(Object.values(l) as Field<unknown>[]),
    }
  })
}

function charge(
  over: Partial<ReviewCharge> & Pick<ReviewCharge, 'key' | 'kind' | 'label'>,
): ReviewCharge {
  return {
    apply: true,
    amount: '',
    currency: 'INR',
    fxRate: '1',
    gst: '0',
    dutyColumn: null,
    payee: '',
    note: '',
    incurredAt: null,
    ...over,
  }
}

const isDay = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s)

function chargesFrom(
  review: DocumentReview,
  extracted: Extracted,
  rate: string,
  labels: { freight: string; insurance: string; duty: Record<'bcd' | 'sws' | 'igst', string> },
): ReviewCharge[] {
  if (extracted.shape === 'supplier_invoice') {
    const d = extracted.data
    const currency = (purchaseCurrencyOf(d.currency.value) ?? 'INR') as PurchaseCurrency
    const note = text(d.invoiceNumber)
    const out: ReviewCharge[] = []
    for (const [key, f, label] of [
      ['freight', d.freight, labels.freight],
      ['insurance', d.insurance, labels.insurance],
    ] as const) {
      if (!f.value) continue
      out.push(
        charge({
          key,
          kind: 'freight_insurance',
          label,
          amount: String(f.value),
          currency,
          fxRate: currency === 'INR' ? '1' : rate,
          note,
        }),
      )
    }
    return out
  }
  if (extracted.shape === 'bill_of_entry') {
    const d = extracted.data
    const note = text(d.beNumber) ? `BE ${text(d.beNumber)}` : ''
    const incurredAt = isDay(text(d.beDate)) ? text(d.beDate) : null
    // Summed lines are rounded to paise: 0.1 + 0.2 must not become 0.30000000000000004.
    const total = (col: 'bcd' | 'sws' | 'igst', printed: Field<number>) =>
      printed.value ?? Number(d.lines.reduce((n, l) => n + (l[col].value ?? 0), 0).toFixed(2))
    return (
      [
        ['bcd', 'customs_bcd', d.totalBcd],
        ['sws', 'customs_sws', d.totalSws],
        ['igst', 'customs_igst', d.totalIgst],
      ] as const
    )
      .map(([col, kind, printed]) =>
        charge({
          key: col,
          kind,
          label: labels.duty[col],
          amount: String(total(col, printed)),
          dutyColumn: col,
          note,
          incurredAt,
        }),
      )
      .filter((c) => Number(c.amount) > 0)
  }
  const d = extracted.data
  const currency = (purchaseCurrencyOf(d.currency.value) ?? 'INR') as PurchaseCurrency
  const amount =
    d.amount.value ?? (d.total.value !== null ? d.total.value - (d.gst.value ?? 0) : null)
  const gstMinor = printedToMinor(d.gst.value ?? 0, currency) ?? 0
  const gstPaise =
    currency === 'INR' || !parseFxRate(rate) ? gstMinor : convertToPaise(gstMinor, currency, rate)
  const kind = CHARGE_KIND_FOR_BILL[review.document.kind]
  return [
    charge({
      key: 'bill',
      kind,
      label: text(d.description) || text(d.payee),
      amount: amount === null ? '' : String(amount),
      currency,
      fxRate: currency === 'INR' ? '1' : rate,
      gst: String(gstPaise / 100),
      payee: text(d.payee),
      note: [text(d.billNumber), text(d.description)].filter(Boolean).join(' · '),
      incurredAt: isDay(text(d.billDate)) ? text(d.billDate) : null,
    }),
  ]
}

/** The review screen's starting point: the AI's reading, its matches, sensible ticks. */
export function initialReview(
  review: DocumentReview,
  labels: Parameters<typeof chargesFrom>[3],
): ReviewState | null {
  const extracted = review.extracted
  if (!extracted) return null
  const order = ownOrder(review)
  const currency = (purchaseCurrencyOf(extracted.data.currency.value) ??
    order?.currency ??
    'INR') as PurchaseCurrency
  const beRate =
    extracted.shape === 'bill_of_entry' ? printedRate(extracted.data.exchangeRate.value) : null
  const sameCurrency = review.orders.find((o) => o.currency === currency)
  const rate =
    beRate ??
    (sameCurrency ? Number(sameCurrency.fxRate).toString() : currency === 'INR' ? '1' : '')
  const be = extracted.shape === 'bill_of_entry' ? extracted.data : null
  return {
    shape: extracted.shape,
    currency,
    // A Bill of Entry's rate is the one customs used: offered by default. An invoice in
    // another currency than the draft order offers to switch it.
    setRate:
      currency !== 'INR' &&
      (beRate !== null
        ? review.orders.some((o) => o.currency === currency)
        : extracted.shape === 'supplier_invoice' &&
          order?.status === 'draft' &&
          order.currency !== currency),
    fxRate: rate,
    writeLines: extracted.shape === 'supplier_invoice',
    saveBillOfEntry: be !== null && review.shipment !== null,
    billOfEntry: {
      number: text(be?.beNumber),
      date: isDay(text(be?.beDate)) ? text(be?.beDate) : '',
      port: text(be?.port),
    },
    lines: linesFrom(review, extracted),
    charges: chargesFrom(review, extracted, rate, labels),
  }
}

export type ApplyProblem = 'nothing' | 'needRate' | 'needMatch' | 'badNumber'

const rupees = (s: string) => parseAmountMinor(s || '0', 'INR', true)

/** The order line behind a review line, when it is one. */
const orderLine = (review: DocumentReview, line: ReviewLine) =>
  review.lines.find((l) => l.lineId === line.target?.lineId) ?? null

/**
 * Paise per order line for a goods adjustment: order quantity × (invoice price − order price),
 * for ticked lines on order lines priced in the document's currency.
 */
export function priceDifferences(review: DocumentReview, s: ReviewState) {
  const order = ownOrder(review)
  if (!order || order.currency !== s.currency) return []
  return s.lines.flatMap((l) => {
    const po = orderLine(review, l)
    const price = parseAmountMinor(l.unitPrice, s.currency)
    if (!l.apply || !po || price === null || price === po.unitPriceMinor) return []
    return [
      {
        lineId: po.lineId,
        amountPaise: convertToPaise(
          po.quantity * (price - po.unitPriceMinor),
          order.currency,
          s.fxRate || order.fxRate,
        ),
      },
    ]
  })
}

function dutySplits(s: ReviewState, col: 'bcd' | 'sws' | 'igst') {
  const lines = s.lines.filter((l) => Number(l.duties[col] || 0) !== 0)
  if (lines.length === 0 || lines.some((l) => !l.target?.lineId)) return null
  const splits = lines.map((l) => ({
    lineId: l.target?.lineId as string,
    amountPaise: rupees(l.duties[col]),
  }))
  if (splits.some((x) => x.amountPaise === null)) return null
  const byLine = new Map<string, number>()
  for (const x of splits)
    byLine.set(x.lineId, (byLine.get(x.lineId) ?? 0) + (x.amountPaise as number))
  return [...byLine].map(([lineId, amountPaise]) => ({ lineId, amountPaise }))
}

/** The per-line split of a Bill of Entry duty, when every line is matched and the lines add up to the charge. */
function perLineSplits(s: ReviewState, c: ReviewCharge) {
  if (!c.dutyColumn) return null
  const splits = dutySplits(s, c.dutyColumn)
  const total = splits?.reduce((n, x) => n + x.amountPaise, 0)
  return splits && total === parseAmountMinor(c.amount, c.currency) ? splits : null
}

/** True when a Bill of Entry duty goes on each product at the amount printed for it. */
export const splitsPerLine = (s: ReviewState, c: ReviewCharge) => perLineSplits(s, c) !== null

/** The Apply request for what is ticked, or why it cannot be sent yet. */
export function toApplyInput(
  review: DocumentReview,
  s: ReviewState,
  adjustNote: string,
): { input: ApplyDocument } | { problem: ApplyProblem } {
  const input: ApplyDocument = { id: review.document.id, lines: [], charges: [] }
  const draft = isDraft(review)
  if (s.setRate) {
    if (s.currency !== 'INR' && !parseFxRate(s.fxRate)) return { problem: 'needRate' }
    input.currency = s.currency
    if (s.currency !== 'INR') input.fxRate = s.fxRate
  }
  if (s.shape === 'supplier_invoice' && s.writeLines) {
    const ticked = s.lines.filter((l) => l.apply)
    if (ticked.some((l) => !l.target)) return { problem: 'needMatch' }
    if (draft) {
      for (const l of ticked) {
        const quantity = Number(l.quantity)
        const price = parseAmountMinor(l.unitPrice, s.currency)
        if (!Number.isInteger(quantity) || quantity < 1 || price === null)
          return { problem: 'badNumber' }
        input.lines.push({
          ...(l.target?.lineId ? { lineId: l.target.lineId } : {}),
          variantId: l.target?.variantId as string,
          quantity,
          unitPriceMinor: price,
          hsnCode: /^\d{4,8}$/.test(l.hsnCode) ? l.hsnCode : '',
        })
      }
      // Lines move to the document's currency: the order must switch with them.
      if (input.lines.length && !input.currency && ownOrder(review)?.currency !== s.currency) {
        return { problem: 'needRate' }
      }
    } else {
      const splits = priceDifferences(review, s)
      const total = splits.reduce((n, x) => n + x.amountPaise, 0)
      if (total !== 0) {
        input.charges.push({
          kind: 'goods_adjustment',
          amountMinor: total,
          currency: 'INR',
          fxRate: '1',
          gstPaise: 0,
          splitMethod: 'manual',
          manualSplits: splits,
          note: adjustNote,
        })
      }
    }
  }
  if (s.saveBillOfEntry && review.shipment) {
    input.billOfEntry = {
      number: s.billOfEntry.number || undefined,
      date: s.billOfEntry.date || null,
      port: s.billOfEntry.port || undefined,
    }
  }
  for (const c of s.charges.filter((x) => x.apply)) {
    const amountMinor = parseAmountMinor(c.amount, c.currency)
    const gstPaise = rupees(c.gst)
    if (amountMinor === null || amountMinor === 0 || gstPaise === null || gstPaise < 0)
      return { problem: 'badNumber' }
    if (c.currency !== 'INR' && !parseFxRate(c.fxRate)) return { problem: 'needRate' }
    const splits = perLineSplits(s, c)
    input.charges.push({
      kind: c.kind,
      amountMinor,
      currency: c.currency,
      fxRate: c.currency === 'INR' ? '1' : c.fxRate,
      gstPaise,
      ...(splits ? { splitMethod: 'manual' as const, manualSplits: splits } : {}),
      payee: c.payee || undefined,
      note: c.note || undefined,
      incurredAt: c.incurredAt,
    })
  }
  const empty =
    !input.currency && input.lines.length === 0 && input.charges.length === 0 && !input.billOfEntry
  return empty ? { problem: 'nothing' } : { input }
}
