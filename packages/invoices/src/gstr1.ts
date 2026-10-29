import { wallClock } from '@commerce/dates'
import { summariseByHsn } from './document'
import type { DocumentLine, DocumentSnapshot, HsnRow, TaxRow } from './snapshot'

/**
 * GSTR-1 treats an inter-state sale to an unregistered buyer as "B2C large"
 * (invoice-wise, Table 5) above this value. Notification 12/2024-Central Tax
 * lowered it from ₹2.5 lakh to ₹1 lakh from 1 August 2024.
 */
export const B2CL_THRESHOLD_PAISE = 1_00_000_00

export type Gstr1Invoice = {
  number: string
  issuedAt: Date
  buyerName: string
  buyerGstin: string | null
  placeOfSupply: { gstCode: string; name: string } | null
  interState: boolean
  totalPaise: number
  taxSummary: TaxRow[]
  lines: DocumentLine[]
  /** A bill of supply under the composition scheme (not reported in GSTR-1). */
  composition?: boolean
  /** Table 6A: with (WPAY) or without (WOPAY) payment of IGST. */
  export: {
    type: 'WPAY' | 'WOPAY'
    portCode: string | null
    shippingBillNumber: string | null
    shippingBillDate: string | null
  } | null
}

export type Gstr1CreditNote = {
  number: string
  issuedAt: Date
  invoice: Gstr1Invoice
  totalPaise: number
  taxSummary: TaxRow[]
  lines: DocumentLine[]
}

/** The GSTR-1 view of an issued document snapshot. */
export function gstr1Invoice(doc: DocumentSnapshot): Gstr1Invoice {
  return {
    number: doc.number ?? '',
    issuedAt: new Date(doc.issuedAt),
    buyerName: doc.buyer.name,
    buyerGstin: doc.buyer.gstin,
    placeOfSupply: doc.placeOfSupply,
    interState: doc.interState,
    totalPaise: doc.totals.totalPaise,
    taxSummary: doc.taxSummary,
    lines: doc.lines,
    composition: doc.composition,
    export: doc.exportSupply
      ? {
          type: doc.exportSupply.mode === 'igst' ? 'WPAY' : 'WOPAY',
          portCode: doc.exportSupply.portCode,
          shippingBillNumber: doc.exportSupply.shippingBillNumber,
          shippingBillDate: doc.exportSupply.shippingBillDate,
        }
      : null,
  }
}

/** A credit note beside the invoice it reverses. */
export function gstr1CreditNote(
  note: DocumentSnapshot,
  invoice: DocumentSnapshot,
): Gstr1CreditNote {
  return {
    number: note.number ?? '',
    issuedAt: new Date(note.issuedAt),
    invoice: gstr1Invoice(invoice),
    totalPaise: note.totals.totalPaise,
    taxSummary: note.taxSummary,
    lines: note.lines,
  }
}

export type Gstr1Section = 'b2b' | 'b2cl' | 'b2cs' | 'exp' | 'hsn' | 'cdnr' | 'cdnur' | 'docs'

export type Gstr1Export = Record<Gstr1Section, string>

const amount = (paise: number) => (paise / 100).toFixed(2)
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
/** `05-Sep-2026` in IST, the offline tool's format. Built by hand: ICU prints `Sept` for en-GB. */
const date = (d: Date) => {
  const ist = wallClock(d)
  const day = String(ist.getUTCDate()).padStart(2, '0')
  return `${day}-${MONTHS[ist.getUTCMonth()]}-${ist.getUTCFullYear()}`
}
const pos = (p: Gstr1Invoice['placeOfSupply']) => (p ? `${p.gstCode}-${p.name}` : '')

function csv(header: string[], rows: (string | number)[][]): string {
  const cell = (v: string | number) => {
    const s = String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [header, ...rows].map((r) => r.map(cell).join(',')).join('\n')
}

/** Which table an invoice belongs to. */
export function gstr1Bucket(
  inv: Pick<Gstr1Invoice, 'buyerGstin' | 'interState' | 'totalPaise'> & {
    export?: Gstr1Invoice['export'] | undefined
  },
) {
  if (inv.export) return 'exp' as const
  if (inv.buyerGstin) return 'b2b' as const
  if (inv.interState && inv.totalPaise > B2CL_THRESHOLD_PAISE) return 'b2cl' as const
  return 'b2cs' as const
}

/**
 * The period's outward supplies laid out like the GST offline tool's CSV
 * templates, one file per table. Credit notes to registered buyers go to CDNR,
 * credit notes against B2C large invoices to CDNUR, and the rest are netted
 * into B2C small, which is how the portal expects them.
 */
/** Every numbered document of the period, cancelled ones included, for Table 13. */
export type Gstr1Document = {
  kind: 'tax_invoice' | 'credit_note' | 'receipt_voucher' | 'refund_voucher'
  /** The numbering series; Table 13 reports each series on its own row. */
  series: string
  number: string
  seq: number
  cancelled: boolean
}

/** Table 13 rows, in the order the return lists them. */
const DOC_NATURE = {
  tax_invoice: 'Invoices for outward supply',
  credit_note: 'Credit Note',
  receipt_voucher: 'Receipt Voucher',
  refund_voucher: 'Refund Voucher',
} as const

/**
 * Table 13, documents issued: per series the first and last number, how many
 * were issued and how many cancelled. Cancelled numbers stay in the count;
 * they are never reused.
 */
export function documentsIssued(docs: readonly Gstr1Document[]) {
  return (Object.keys(DOC_NATURE) as (keyof typeof DOC_NATURE)[]).flatMap((kind) =>
    [...new Set(docs.filter((d) => d.kind === kind).map((d) => d.series))].sort().flatMap((name) =>
      seriesRow(
        kind,
        docs.filter((d) => d.kind === kind && d.series === name),
      ),
    ),
  )
}

function seriesRow(kind: keyof typeof DOC_NATURE, docs: readonly Gstr1Document[]) {
  const series = [...docs].sort((a, b) => a.seq - b.seq)
  const first = series[0]
  const last = series.at(-1)
  if (!first || !last) return []
  const cancelled = series.filter((d) => d.cancelled).length
  return [
    {
      nature: DOC_NATURE[kind],
      from: first.number,
      to: last.number,
      total: series.length,
      cancelled,
      net: series.length - cancelled,
    },
  ]
}

export function buildGstr1(
  invoices: readonly Gstr1Invoice[],
  creditNotes: readonly Gstr1CreditNote[],
  documents: readonly Gstr1Document[] = [],
): Gstr1Export {
  const b2b: (string | number)[][] = []
  const b2cl: (string | number)[][] = []
  const exp: (string | number)[][] = []
  const b2cs = new Map<string, { pos: string; rate: number; taxable: number }>()
  const hsnLines: DocumentLine[] = []

  const addSmall = (inv: Gstr1Invoice, rows: readonly TaxRow[], sign: 1 | -1) => {
    for (const r of rows) {
      if (r.ratePercent <= 0) continue
      const key = `${pos(inv.placeOfSupply)}|${r.ratePercent}`
      const row = b2cs.get(key) ?? { pos: pos(inv.placeOfSupply), rate: r.ratePercent, taxable: 0 }
      row.taxable += sign * r.taxablePaise
      b2cs.set(key, row)
    }
  }

  for (const inv of invoices) {
    hsnLines.push(...inv.lines)
    const bucket = gstr1Bucket(inv)
    if (inv.export) {
      const x = inv.export
      for (const r of inv.taxSummary) {
        exp.push([
          x.type,
          inv.number,
          date(inv.issuedAt),
          amount(inv.totalPaise),
          x.portCode ?? '',
          x.shippingBillNumber ?? '',
          x.shippingBillDate ? date(new Date(x.shippingBillDate)) : '',
          x.type === 'WPAY' ? r.ratePercent : 0,
          amount(r.taxablePaise),
          '0.00',
        ])
      }
      continue
    }
    for (const r of inv.taxSummary) {
      // Nil-rated and exempt supplies belong in Table 8, not in these tables.
      if (r.ratePercent <= 0) continue
      if (bucket === 'b2b') {
        b2b.push([
          inv.buyerGstin ?? '',
          inv.buyerName,
          inv.number,
          date(inv.issuedAt),
          amount(inv.totalPaise),
          pos(inv.placeOfSupply),
          'N',
          '',
          'Regular B2B',
          '',
          r.ratePercent,
          amount(r.taxablePaise),
          '0.00',
        ])
      } else if (bucket === 'b2cl') {
        b2cl.push([
          inv.number,
          date(inv.issuedAt),
          amount(inv.totalPaise),
          pos(inv.placeOfSupply),
          '',
          r.ratePercent,
          amount(r.taxablePaise),
          '0.00',
          '',
        ])
      }
    }
    if (bucket === 'b2cs') addSmall(inv, inv.taxSummary, 1)
  }

  const cdnr: (string | number)[][] = []
  const cdnur: (string | number)[][] = []
  for (const cn of creditNotes) {
    hsnLines.push(...cn.lines.map((l) => negate(l)))
    const bucket = gstr1Bucket(cn.invoice)
    if (bucket === 'b2cs') {
      addSmall(cn.invoice, cn.taxSummary, -1)
      continue
    }
    for (const r of cn.taxSummary) {
      if (r.ratePercent <= 0) continue
      const head = [cn.number, date(cn.issuedAt), 'C', pos(cn.invoice.placeOfSupply)]
      const tail = [r.ratePercent, amount(r.taxablePaise), '0.00']
      if (bucket === 'b2b') {
        cdnr.push([
          cn.invoice.buyerGstin ?? '',
          cn.invoice.buyerName,
          ...head,
          'N',
          'Regular B2B',
          amount(cn.totalPaise),
          '',
          ...tail,
        ])
      } else {
        const urType = cn.invoice.export
          ? cn.invoice.export.type === 'WPAY'
            ? 'EXPWP'
            : 'EXPWOP'
          : 'B2CL'
        cdnur.push([urType, ...head, amount(cn.totalPaise), '', ...tail])
      }
    }
  }

  const hsn = summariseByHsn(hsnLines)
  return {
    b2b: csv(
      [
        'GSTIN/UIN of Recipient',
        'Receiver Name',
        'Invoice Number',
        'Invoice date',
        'Invoice Value',
        'Place Of Supply',
        'Reverse Charge',
        'Applicable % of Tax Rate',
        'Invoice Type',
        'E-Commerce GSTIN',
        'Rate',
        'Taxable Value',
        'Cess Amount',
      ],
      b2b,
    ),
    b2cl: csv(
      [
        'Invoice Number',
        'Invoice date',
        'Invoice Value',
        'Place Of Supply',
        'Applicable % of Tax Rate',
        'Rate',
        'Taxable Value',
        'Cess Amount',
        'E-Commerce GSTIN',
      ],
      b2cl,
    ),
    exp: csv(
      [
        'Export Type',
        'Invoice Number',
        'Invoice date',
        'Invoice Value',
        'Port Code',
        'Shipping Bill Number',
        'Shipping Bill Date',
        'Rate',
        'Taxable Value',
        'Cess Amount',
      ],
      exp,
    ),
    b2cs: csv(
      [
        'Type',
        'Place Of Supply',
        'Applicable % of Tax Rate',
        'Rate',
        'Taxable Value',
        'Cess Amount',
        'E-Commerce GSTIN',
      ],
      [...b2cs.values()]
        .filter((r) => r.taxable !== 0)
        .sort((a, b) => a.pos.localeCompare(b.pos) || a.rate - b.rate)
        .map((r) => ['OE', r.pos, '', r.rate, amount(r.taxable), '0.00', '']),
    ),
    hsn: csv(
      [
        'HSN',
        'Description',
        'UQC',
        'Total Quantity',
        'Total Value',
        'Rate',
        'Taxable Value',
        'Integrated Tax Amount',
        'Central Tax Amount',
        'State/UT Tax Amount',
        'Cess Amount',
      ],
      hsn.map((r: HsnRow) => [
        r.hsn,
        '',
        'NOS-NUMBERS',
        r.quantity,
        amount(r.taxablePaise + r.cgstPaise + r.sgstPaise + r.igstPaise),
        r.ratePercent,
        amount(r.taxablePaise),
        amount(r.igstPaise),
        amount(r.cgstPaise),
        amount(r.sgstPaise),
        '0.00',
      ]),
    ),
    cdnr: csv(
      [
        'GSTIN/UIN of Recipient',
        'Receiver Name',
        'Note Number',
        'Note Date',
        'Note Type',
        'Place Of Supply',
        'Reverse Charge',
        'Note Supply Type',
        'Note Value',
        'Applicable % of Tax Rate',
        'Rate',
        'Taxable Value',
        'Cess Amount',
      ],
      cdnr,
    ),
    docs: csv(
      [
        'Nature of Document',
        'Sr. No. From',
        'Sr. No. To',
        'Total Number',
        'Cancelled',
        'Net Issued',
      ],
      documentsIssued(documents).map((d) => [d.nature, d.from, d.to, d.total, d.cancelled, d.net]),
    ),
    cdnur: csv(
      [
        'UR Type',
        'Note Number',
        'Note Date',
        'Note Type',
        'Place Of Supply',
        'Note Value',
        'Applicable % of Tax Rate',
        'Rate',
        'Taxable Value',
        'Cess Amount',
      ],
      cdnur,
    ),
  }
}

function negate(l: DocumentLine): DocumentLine {
  return {
    ...l,
    quantity: -l.quantity,
    grossPaise: -l.grossPaise,
    taxablePaise: -l.taxablePaise,
    cgstPaise: -l.cgstPaise,
    sgstPaise: -l.sgstPaise,
    igstPaise: -l.igstPaise,
    totalPaise: -l.totalPaise,
  }
}
