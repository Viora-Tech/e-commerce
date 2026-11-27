/**
 * SOURCE OF TRUTH: editing an issued tax invoice in place
 * WHAT:  The fields a merchant may correct on an issued tax invoice before its month's GSTR-1 is
 *        filed (line quantity, unit price and discount, shipping and other charges, the buyer's
 *        name, address, GSTIN and place of supply), and the rebuild of the snapshot from them.
 * WHY:   Until the return is filed a wrong invoice is corrected, not credited (owner, 28 Nov
 *        2026; the same as Zoho Books and Tally). The rebuild reuses the issue engine's own
 *        steps (`splitByRate` for the principal rate, `groupsFor` for each rate's tax,
 *        `applyTax`, the summaries and amount in words), so an edited invoice carries exactly
 *        the tax a fresh invoice with the same values would.
 * WHERE: Saved by `editInvoice` in packages/plugin-gst-invoices/src/edit-invoice.ts.
 */
import { sameState, splitByRate } from '@commerce/core/gst'
import { z } from 'zod'
import { applyTax, groupsFor, summariseByHsn, summariseByRate, totalsOf } from './document'
import { formatRupees } from './money'
import { placeOf } from './parties'
import type { DocumentLine, DocumentSnapshot, Party } from './snapshot'
import { amountInWords } from './words'

const paise = z.number().int().min(0).max(10_000_000_000)

/** What the edit form sends: goods lines and charges in the snapshot's order, and the buyer. */
export const InvoiceEditSchema = z.object({
  /** One per goods line of the current snapshot, same order. Quantity 0 drops the line. */
  lines: z
    .array(
      z.object({
        quantity: z.number().int().min(0).max(100_000),
        unitPricePaise: paise,
        discountPaise: paise,
      }),
    )
    .max(500),
  /** One per charge line (shipping, a payment fee), same order. 0 drops the charge. */
  charges: z.array(z.object({ amountPaise: paise })).max(20),
  buyer: z.object({
    name: z.string().trim().min(1).max(200),
    /** Printed address lines, top to bottom. */
    address: z.array(z.string().trim().max(200)).max(6),
    gstin: z.string().trim().toUpperCase().max(15).nullable(),
    /** Two-letter state code of the place of supply (ignored on exports). */
    placeOfSupply: z.string().trim().toUpperCase().max(2),
  }),
})
export type InvoiceEdit = z.infer<typeof InvoiceEditSchema>

/** The edit form's starting values: the snapshot as it stands. */
export function editableOf(doc: DocumentSnapshot): InvoiceEdit {
  return {
    lines: doc.lines
      .filter((l) => !l.charge)
      .map((l) => ({
        quantity: l.quantity,
        unitPricePaise: l.unitPricePaise,
        discountPaise: l.discountPaise,
      })),
    charges: doc.lines.filter((l) => l.charge).map((l) => ({ amountPaise: l.grossPaise })),
    buyer: {
      name: doc.buyer.name,
      address: [...doc.buyer.address],
      gstin: doc.buyer.gstin,
      placeOfSupply: doc.placeOfSupply?.code ?? doc.buyer.state?.code ?? '',
    },
  }
}

export type RebuildResult =
  | { ok: true; doc: DocumentSnapshot }
  | { ok: false; reason: 'shape' | 'no_goods' | 'place' | 'discount' }

type Draft = Omit<DocumentLine, 'taxablePaise' | 'cgstPaise' | 'sgstPaise' | 'igstPaise'>

/**
 * The snapshot with the edit applied, retaxed. Number, date, seller, order and advance stay as
 * issued. A line whose quantity and price did not change keeps its gross (an older invoice may
 * carry a rounding paisa on it), so saving the form unchanged rebuilds the same invoice.
 */
export function rebuildDocument(prior: DocumentSnapshot, edit: InvoiceEdit): RebuildResult {
  const goodsPrior = prior.lines.filter((l) => !l.charge)
  const chargesPrior = prior.lines.filter((l) => l.charge)
  if (edit.lines.length !== goodsPrior.length || edit.charges.length !== chargesPrior.length) {
    return { ok: false, reason: 'shape' }
  }
  const exp = prior.exportSupply
  const place = exp ? prior.placeOfSupply : placeOf(edit.buyer.placeOfSupply)
  if (!place) return { ok: false, reason: 'place' }

  const goods: Draft[] = []
  for (const [i, l] of goodsPrior.entries()) {
    const e = edit.lines[i]
    if (!e || e.quantity === 0) continue
    const same = e.quantity === l.quantity && e.unitPricePaise === l.unitPricePaise
    const grossPaise = same ? l.grossPaise : e.quantity * e.unitPricePaise
    if (e.discountPaise > grossPaise) return { ok: false, reason: 'discount' }
    goods.push({
      ...l,
      quantity: e.quantity,
      unitPricePaise: e.unitPricePaise,
      grossPaise,
      discountPaise: e.discountPaise,
      totalPaise: grossPaise - e.discountPaise,
    })
  }
  if (goods.length === 0) return { ok: false, reason: 'no_goods' }

  // Shipping and fees follow the principal supply, exactly as at issue.
  const { principalRate } = splitByRate({
    lines: goods.map((g) => ({ grossPaise: g.grossPaise, ratePercent: g.ratePercent })),
    totalPaise: goods.reduce((a, g) => a + g.grossPaise, 0),
    reductionPaise: 0,
  })
  const principalHsn = goods.find((g) => g.ratePercent === principalRate)?.hsn ?? ''
  const charges: Draft[] = chargesPrior.flatMap((c, i) => {
    const amount = edit.charges[i]?.amountPaise ?? 0
    if (amount === 0) return []
    return [
      {
        ...c,
        hsn: principalHsn || c.hsn,
        unitPricePaise: c.quantity === 1 ? amount : c.unitPricePaise,
        grossPaise: amount,
        discountPaise: 0,
        ratePercent: principalRate,
        totalPaise: amount,
      },
    ]
  })

  const samePlace = place.code === prior.placeOfSupply?.code
  const interState =
    exp !== null ||
    (samePlace ? prior.interState : !sameState(place.code, prior.seller.state?.code ?? null))
  const lines: DocumentLine[] = [...goods, ...charges].map((d) => ({
    ...d,
    taxablePaise: d.totalPaise,
    cgstPaise: 0,
    sgstPaise: 0,
    igstPaise: 0,
  }))
  const rates = [...new Set(lines.map((l) => l.ratePercent))].sort((a, b) => a - b)
  const amounts = rates.map((r) =>
    lines.reduce((a, l) => (l.ratePercent === r ? a + l.totalPaise : a), 0),
  )
  const total = amounts.reduce((a, b) => a + b, 0)
  for (const g of groupsFor(rates, amounts, null, interState, total)) {
    const lut = exp?.mode === 'lut'
    applyTax(
      lines.filter((l) => l.ratePercent === g.ratePercent),
      lut ? 0 : g.taxPaise,
      lut ? 0 : g.sgstPaise,
      interState,
    )
  }

  const buyer: Party = {
    ...prior.buyer,
    name: edit.buyer.name,
    address: edit.buyer.address.filter(Boolean),
    gstin: edit.buyer.gstin?.trim() || null,
    // Without a separate ship-to the bill-to state is where the goods went.
    state: prior.shipTo || exp ? prior.buyer.state : place,
  }
  const totals = totalsOf(lines)
  return {
    ok: true,
    doc: {
      ...prior,
      buyer,
      placeOfSupply: place,
      interState,
      lines,
      taxSummary: summariseByRate(lines),
      hsnSummary: summariseByHsn(lines),
      totals,
      amountInWords: amountInWords(totals.totalPaise),
    },
  }
}

/**
 * What an edit changed, one line per change, for the version history and the order timeline:
 * "Kurta / M: quantity 2 → 1", "Buyer GSTIN: none → 27…", "Total: ₹2,000.00 → ₹1,000.00".
 */
export function editChanges(prior: DocumentSnapshot, next: DocumentSnapshot): string[] {
  const out: string[] = []
  const was = (v: string | null | undefined) => v?.trim() || 'none'
  const goodsBefore = prior.lines.filter((l) => !l.charge)
  const goodsAfter = new Map(
    next.lines.filter((l) => !l.charge).map((l) => [l.orderLineId ?? l.description, l]),
  )
  for (const l of goodsBefore) {
    const n = goodsAfter.get(l.orderLineId ?? l.description)
    if (!n) {
      out.push(`${l.description}: removed`)
      continue
    }
    if (n.quantity !== l.quantity)
      out.push(`${l.description}: quantity ${l.quantity} → ${n.quantity}`)
    if (n.unitPricePaise !== l.unitPricePaise) {
      out.push(
        `${l.description}: unit price ${formatRupees(l.unitPricePaise)} → ${formatRupees(n.unitPricePaise)}`,
      )
    }
    if (n.discountPaise !== l.discountPaise) {
      out.push(
        `${l.description}: discount ${formatRupees(l.discountPaise)} → ${formatRupees(n.discountPaise)}`,
      )
    }
  }
  const chargesAfter = new Map(next.lines.filter((l) => l.charge).map((l) => [l.description, l]))
  for (const c of prior.lines.filter((l) => l.charge)) {
    const after = chargesAfter.get(c.description)?.grossPaise ?? 0
    if (after !== c.grossPaise) {
      out.push(`${c.description}: ${formatRupees(c.grossPaise)} → ${formatRupees(after)}`)
    }
  }
  if (next.buyer.name !== prior.buyer.name) {
    out.push(`Buyer name: ${prior.buyer.name} → ${next.buyer.name}`)
  }
  if (next.buyer.address.join(', ') !== prior.buyer.address.join(', ')) {
    out.push('Buyer address changed')
  }
  if ((next.buyer.gstin ?? null) !== (prior.buyer.gstin ?? null)) {
    out.push(`Buyer GSTIN: ${was(prior.buyer.gstin)} → ${was(next.buyer.gstin)}`)
  }
  if (next.placeOfSupply?.code !== prior.placeOfSupply?.code) {
    out.push(
      `Place of supply: ${was(prior.placeOfSupply?.name)} → ${was(next.placeOfSupply?.name)}`,
    )
  }
  if (next.totals.totalPaise !== prior.totals.totalPaise) {
    out.push(
      `Total: ${formatRupees(prior.totals.totalPaise)} → ${formatRupees(next.totals.totalPaise)}`,
    )
  }
  return out
}
