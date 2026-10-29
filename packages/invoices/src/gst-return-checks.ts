import { validateGstin } from '@commerce/core/gstin'
import { type Gstr1CreditNote, type Gstr1Invoice, gstr1Bucket } from './gstr1'
import type { Gstr1Json } from './gstr1-json'

/** GST rates the portal accepts on a GSTR-1 row (GST 2.0 from 22 Sept 2025 added 40%). */
const GSTR1_RATES = [0, 0.1, 0.25, 1, 1.5, 3, 5, 6, 7.5, 12, 18, 28, 40] as const

/** The portal's document number rule: up to 16 letters, digits, `/` and `-`. */
const DOC_NUMBER = /^[A-Za-z0-9/-]{1,16}$/

export type GstReturnWarning =
  /** Goods lines printed without an HSN code, or with fewer than four digits. */
  | { code: 'missing_hsn'; numbers: string[] }
  /** B2B invoices whose buyer GSTIN fails the format or checksum: the portal rejects them. */
  | { code: 'invalid_buyer_gstin'; numbers: string[] }
  /** Orders billed to a business name with no GSTIN: reported as B2C. */
  | { code: 'business_without_gstin'; numbers: string[] }
  /** Numbers the portal will not take (over 16 characters, or other characters). */
  | { code: 'bad_document_number'; numbers: string[] }
  /** A rate the portal has no row for. */
  | { code: 'bad_rate'; numbers: string[] }
  /** Cancelled in the app this month: counted as cancelled in Table 13, left out elsewhere. */
  | { code: 'cancelled'; numbers: string[] }
  /** Cancelled after the month was marked filed: delete or amend them on the portal. */
  | { code: 'cancelled_after_filing'; numbers: string[] }
  /** Credit notes whose invoice could not be found; they are left out of the return. */
  | { code: 'orphan_credit_note'; numbers: string[] }
  /** B2C small rows that net below zero after credit notes. */
  | { code: 'negative_b2cs'; numbers: string[] }
  /** HSN rows whose quantity nets below zero; reported as 0 (the portal refuses negatives). */
  | { code: 'negative_hsn_quantity'; numbers: string[] }
  /** Bills of supply under the composition scheme: those file CMP-08 and GSTR-4, not GSTR-1. */
  | { code: 'composition'; numbers: string[] }

export type GstReturnCheckInput = {
  invoices: readonly (Gstr1Invoice & { composition?: boolean })[]
  creditNotes: readonly Gstr1CreditNote[]
  gstr1: Gstr1Json
  /** Invoice numbers whose order named a business but carried no GSTIN. */
  businessWithoutGstin?: readonly string[]
  cancelled?: readonly { number: string; afterFiling: boolean }[]
  orphanCreditNotes?: readonly string[]
  /** Net HSN quantities before the JSON clamps them at zero, keyed `hsn|rate`. */
  hsnNetQuantities?: ReadonlyMap<string, number>
}

const uniq = (xs: readonly string[]) => [...new Set(xs)].sort()

/** What to fix (or know) before uploading the month's return. Empty lists are left out. */
export function gstReturnChecks(input: GstReturnCheckInput): GstReturnWarning[] {
  const docs = [...input.invoices, ...input.creditNotes]
  const lines = (d: (typeof docs)[number]) => d.lines
  const out: GstReturnWarning[] = [
    {
      code: 'missing_hsn',
      numbers: docs
        .filter((d) => lines(d).some((l) => !l.charge && !/^[0-9]{4,8}$/.test(l.hsn.trim())))
        .map((d) => d.number),
    },
    {
      code: 'invalid_buyer_gstin',
      numbers: input.invoices
        .filter((i) => i.buyerGstin && !validateGstin(i.buyerGstin).ok)
        .map((i) => i.number),
    },
    { code: 'business_without_gstin', numbers: [...(input.businessWithoutGstin ?? [])] },
    {
      code: 'bad_document_number',
      numbers: docs.filter((d) => !DOC_NUMBER.test(d.number)).map((d) => d.number),
    },
    {
      code: 'bad_rate',
      numbers: docs
        .filter((d) =>
          d.taxSummary.some((r) => !(GSTR1_RATES as readonly number[]).includes(r.ratePercent)),
        )
        .map((d) => d.number),
    },
    {
      code: 'cancelled',
      numbers: (input.cancelled ?? []).filter((c) => !c.afterFiling).map((c) => c.number),
    },
    {
      code: 'cancelled_after_filing',
      numbers: (input.cancelled ?? []).filter((c) => c.afterFiling).map((c) => c.number),
    },
    { code: 'orphan_credit_note', numbers: [...(input.orphanCreditNotes ?? [])] },
    {
      code: 'negative_b2cs',
      numbers: (input.gstr1.b2cs ?? []).filter((r) => r.txval < 0).map((r) => `${r.pos} ${r.rt}%`),
    },
    {
      code: 'negative_hsn_quantity',
      numbers: [...(input.hsnNetQuantities ?? new Map()).entries()]
        .filter(([, q]) => q < 0)
        .map(([k]) => k.split('|')[0] ?? k),
    },
    {
      code: 'composition',
      numbers: input.invoices.filter((i) => i.composition).map((i) => i.number),
    },
  ]
  return out.map((w) => ({ ...w, numbers: uniq(w.numbers) })).filter((w) => w.numbers.length > 0)
}

/** Net goods quantity per `hsn|rate` across the month, before any clamping. */
export function hsnNetQuantities(
  invoices: readonly Gstr1Invoice[],
  creditNotes: readonly Gstr1CreditNote[],
): Map<string, number> {
  const out = new Map<string, number>()
  const add = (inv: Gstr1Invoice | Gstr1CreditNote, sign: 1 | -1, bucket: string) => {
    for (const l of inv.lines) {
      if (l.charge || l.hsn.startsWith('99')) continue
      const key = `${l.hsn}|${l.ratePercent}|${bucket}`
      out.set(key, (out.get(key) ?? 0) + sign * l.quantity)
    }
  }
  for (const i of invoices) add(i, 1, gstr1Bucket(i) === 'b2b' ? 'b2b' : 'b2c')
  for (const n of creditNotes) add(n, -1, gstr1Bucket(n.invoice) === 'b2b' ? 'b2b' : 'b2c')
  return out
}
