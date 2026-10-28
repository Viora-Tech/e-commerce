import { allocatePaise } from '@commerce/core/gst'
import { applyTax, inclusiveTax, summariseByHsn, summariseByRate, totalsOf } from './document'
import type { DocumentLine, DocumentSnapshot } from './snapshot'
import { amountInWords } from './words'

/** Units of one order line that came back, for a credit note on a return. */
export type ReturnedUnits = { orderLineId: string; quantity: number }

export type CreditNoteInput = {
  invoice: DocumentSnapshot
  number: string
  issuedAt: Date
  amountPaise: number
  reason: string | null
  /** The refund is for a return of these units: they are what the note credits. */
  returned?: readonly ReturnedUnits[] | undefined
}

/**
 * A credit note against an invoice for a refund (CGST rule 53(1A)), with the tax inside it
 * reversed at each credited line's rate, in the invoice's CGST/SGST or IGST shape.
 *
 * - A full refund reverses the invoice line for line.
 * - A refund for a return credits the returned units, at their own rate and quantity (s.34:
 *   the note relates to the goods that came back). Less than their value (a fee kept back)
 *   scales them down; more (shipping refunded too) spreads the rest over the other lines.
 * - Any other refund (goodwill, a price adjustment), or a return the invoice cannot match
 *   (issued before invoice lines recorded their order line), is spread over every line by value.
 */
export function buildCreditNote(input: CreditNoteInput): DocumentSnapshot {
  const { invoice } = input
  const invoiceTotal = invoice.totals.totalPaise
  const refund = Math.min(Math.max(0, input.amountPaise), invoiceTotal)
  const full = refund === invoiceTotal
  const lines = full
    ? invoice.lines.map((l) => ({ ...l }))
    : creditLines(
        invoice,
        returnShares(invoice, refund, input.returned ?? []) ?? valueShares(invoice, refund),
      )
  const totals = totalsOf(lines)
  return {
    ...invoice,
    kind: 'credit_note',
    number: input.number,
    issuedAt: input.issuedAt.toISOString(),
    order: { ...invoice.order, collectPaise: 0 },
    advance: null,
    original: { number: invoice.number ?? '', issuedAt: invoice.issuedAt },
    einvoice: null,
    reason: input.reason,
    lines,
    taxSummary: summariseByRate(lines),
    hsnSummary: summariseByHsn(lines),
    totals,
    amountInWords: amountInWords(totals.totalPaise),
  }
}

/** What a credit note takes from each invoice line: an amount, and the units it covers. */
type CreditShares = { nets: number[]; units: number[] }

/** A value-only part refund: every line by value, no units. */
function valueShares(invoice: DocumentSnapshot, refund: number): CreditShares {
  return {
    nets: allocatePaise(
      refund,
      invoice.lines.map((l) => l.totalPaise),
    ),
    units: invoice.lines.map(() => 0),
  }
}

/** A refund for a return: the returned units first (see `buildCreditNote`); null when none match. */
function returnShares(
  invoice: DocumentSnapshot,
  refund: number,
  returned: readonly ReturnedUnits[],
): CreditShares | null {
  const units = invoice.lines.map((l) => {
    if (l.charge || !l.orderLineId || l.quantity <= 0) return 0
    const back = returned
      .filter((r) => r.orderLineId === l.orderLineId)
      .reduce((n, r) => n + Math.max(0, r.quantity), 0)
    return Math.min(back, l.quantity)
  })
  if (units.every((u) => u === 0)) return null
  // What the returned units were invoiced at: their share of the line, discount included.
  const values = invoice.lines.map((l, i) =>
    Math.round((l.totalPaise * (units[i] ?? 0)) / Math.max(1, l.quantity)),
  )
  const goods = values.reduce((n, v) => n + v, 0)
  if (refund <= goods) return { nets: allocatePaise(refund, values), units }
  const rest = allocatePaise(
    refund - goods,
    invoice.lines.map((l, i) => Math.max(0, l.totalPaise - (values[i] ?? 0))),
  )
  return { nets: values.map((v, i) => v + (rest[i] ?? 0)), units }
}

function creditLines(invoice: DocumentSnapshot, shares: CreditShares): DocumentLine[] {
  const lines: DocumentLine[] = invoice.lines.map((l, i) => {
    const net = shares.nets[i] ?? 0
    const units = shares.units[i] ?? 0
    return {
      ...l,
      // Units for returned goods; quantity 0 marks a value-only line.
      quantity: units,
      unitPricePaise: units > 0 ? Math.round(net / units) : net,
      grossPaise: net,
      discountPaise: 0,
      taxablePaise: net,
      cgstPaise: 0,
      sgstPaise: 0,
      igstPaise: 0,
      totalPaise: net,
    }
  })
  const rates = [...new Set(lines.map((l) => l.ratePercent))]
  for (const rate of rates) {
    const members = lines.filter((l) => l.ratePercent === rate)
    const amount = members.reduce((a, l) => a + l.totalPaise, 0)
    const tax = invoice.exportSupply?.mode === 'lut' ? 0 : inclusiveTax(amount, rate)
    applyTax(members, tax, invoice.interState ? 0 : Math.floor(tax / 2), invoice.interState)
  }
  return lines.filter((l) => l.totalPaise > 0)
}
