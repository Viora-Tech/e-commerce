import { wallClock } from '@commerce/dates'
import { type Gstr1CreditNote, type Gstr1Document, type Gstr1Invoice, gstr1Bucket } from './gstr1'
import type { DocumentLine, TaxRow } from './snapshot'

/**
 * GSTR-1 as the JSON the GST portal accepts on "Prepare offline → Upload" (the file the
 * Returns Offline Tool generates). GSTN publishes no formal schema; the shape follows what
 * offline tool 3.x writes, with the Phase-III changes in force from the May 2025 return:
 * Table 12 split into `hsn_b2b` / `hsn_b2c`, rate required on every HSN row, no total value
 * column. Notes, field by field: developer docs, "GST returns".
 */
const GSTR1_JSON_VERSION = 'GST3.2.1'

/** One rate's slice of an invoice or note. Amounts are rupees with two decimals. */
export type Gstr1Item = {
  num: number
  itm_det: { rt: number; txval: number; iamt: number; camt?: number; samt?: number; csamt: number }
}

export type Gstr1B2bInvoice = {
  inum: string
  idt: string
  val: number
  pos: string
  rchrg: 'N'
  inv_typ: 'R'
  itms: Gstr1Item[]
}

export type Gstr1B2clInvoice = { inum: string; idt: string; val: number; itms: Gstr1Item[] }

export type Gstr1B2csRow = {
  sply_ty: 'INTRA' | 'INTER'
  pos: string
  typ: 'OE'
  rt: number
  txval: number
  iamt: number
  camt: number
  samt: number
  csamt: number
}

export type Gstr1ExpInvoice = {
  inum: string
  idt: string
  val: number
  sbpcode?: string
  sbnum?: number
  sbdt?: string
  itms: { txval: number; rt: number; iamt: number; csamt: number }[]
}

export type Gstr1CdnrNote = {
  ntty: 'C'
  nt_num: string
  nt_dt: string
  val: number
  pos: string
  rchrg: 'N'
  inv_typ: 'R'
  itms: Gstr1Item[]
}

export type Gstr1CdnurNote = {
  typ: 'B2CL' | 'EXPWP' | 'EXPWOP'
  ntty: 'C'
  nt_num: string
  nt_dt: string
  val: number
  pos?: string
  itms: Gstr1Item[]
}

export type Gstr1HsnRow = {
  /** The portal reads `hsn_sc` first; keep it the first key. */
  hsn_sc: string
  num: number
  desc: string
  uqc: string
  qty: number
  rt: number
  txval: number
  iamt: number
  camt: number
  samt: number
  csamt: number
}

/** Table 8 by supply type: inter (INTR) or intra (INTRA) state, to registered (B2B) or not. */
export type Gstr1NilRow = {
  sply_ty: 'INTRB2B' | 'INTRAB2B' | 'INTRB2C' | 'INTRAB2C'
  nil_amt: number
  expt_amt: number
  ngsup_amt: number
}

export type Gstr1DocDet = {
  doc_num: number
  docs: {
    num: number
    from: string
    to: string
    totnum: number
    cancel: number
    net_issue: number
  }[]
}

export type Gstr1Json = {
  gstin: string
  fp: string
  version: string
  hash: 'hash'
  b2b?: { ctin: string; inv: Gstr1B2bInvoice[] }[]
  b2cl?: { pos: string; inv: Gstr1B2clInvoice[] }[]
  b2cs?: Gstr1B2csRow[]
  exp?: { exp_typ: 'WPAY' | 'WOPAY'; inv: Gstr1ExpInvoice[] }[]
  cdnr?: { ctin: string; nt: Gstr1CdnrNote[] }[]
  cdnur?: Gstr1CdnurNote[]
  nil?: { inv: Gstr1NilRow[] }
  hsn: { hsn_b2b: Gstr1HsnRow[]; hsn_b2c: Gstr1HsnRow[] }
  doc_issue: { doc_det: Gstr1DocDet[] }
}

export type Gstr1JsonInput = {
  /** The GSTIN filing; its first two digits are the supplier's state. */
  gstin: string
  /** `YYYY-MM`. */
  period: string
  invoices: readonly Gstr1Invoice[]
  creditNotes: readonly Gstr1CreditNote[]
  documents: readonly Gstr1Document[]
}

/** Paise to rupees. Every amount is summed in integer paise first, so this is exact. */
export const rupees = (paise: number) => Math.round(paise) / 100

/** `05-09-2026` in IST: the JSON's date format (the CSVs use `05-Sep-2026`). */
function jsonDate(at: Date): string {
  const ist = wallClock(at)
  const dd = String(ist.getUTCDate()).padStart(2, '0')
  const mm = String(ist.getUTCMonth() + 1).padStart(2, '0')
  return `${dd}-${mm}-${ist.getUTCFullYear()}`
}

/** `2026-09` → `092026`. */
const filingPeriod = (period: string) => `${period.slice(5, 7)}${period.slice(0, 4)}`

/** Table 13's document codes, in the portal's numbering. */
const DOC_NUM = { tax_invoice: 1, credit_note: 5, receipt_voucher: 6, refund_voucher: 8 } as const

/** Services HSN (SAC 99…) carry no quantity: UQC `NA`, quantity 0. */
const isService = (hsn: string) => hsn.startsWith('99')

/** The two-digit state code a supply is reported under; the supplier's own when unknown. */
const posOf = (inv: Gstr1Invoice, ownState: string) => inv.placeOfSupply?.gstCode ?? ownState

/** Taxed rate rows as items. Nil-rated rows go to Table 8, not here. */
function items(rows: readonly TaxRow[], withSplit: boolean): Gstr1Item[] {
  return rows
    .filter((r) => r.ratePercent > 0)
    .map((r, i) => ({
      num: i + 1,
      itm_det: withSplit
        ? {
            rt: r.ratePercent,
            txval: rupees(r.taxablePaise),
            iamt: rupees(r.igstPaise),
            camt: rupees(r.cgstPaise),
            samt: rupees(r.sgstPaise),
            csamt: 0,
          }
        : {
            rt: r.ratePercent,
            txval: rupees(r.taxablePaise),
            iamt: rupees(r.igstPaise),
            csamt: 0,
          },
    }))
}

function groupBy<T, K extends string>(rows: readonly T[], key: (row: T) => K): Map<K, T[]> {
  const out = new Map<K, T[]>()
  for (const row of rows) {
    const k = key(row)
    out.set(k, [...(out.get(k) ?? []), row])
  }
  return out
}

type HsnAcc = {
  hsn: string
  rate: number
  desc: string
  qty: number
  taxable: number
  igst: number
  cgst: number
  sgst: number
}

/** Table 12 rows, net of credit notes, numbered from 1. */
function hsnRows(lines: readonly { line: DocumentLine; sign: 1 | -1 }[]): Gstr1HsnRow[] {
  const acc = new Map<string, HsnAcc>()
  for (const { line: l, sign } of lines) {
    const key = `${l.hsn}|${l.ratePercent}`
    const row = acc.get(key) ?? {
      hsn: l.hsn,
      rate: l.ratePercent,
      desc: '',
      qty: 0,
      taxable: 0,
      igst: 0,
      cgst: 0,
      sgst: 0,
    }
    // Shipping and fees ride on the goods' HSN for value but are not units sold.
    if (!l.charge) {
      row.qty += sign * l.quantity
      if (!row.desc) row.desc = l.description.slice(0, 30)
    }
    row.taxable += sign * l.taxablePaise
    row.igst += sign * l.igstPaise
    row.cgst += sign * l.cgstPaise
    row.sgst += sign * l.sgstPaise
    acc.set(key, row)
  }
  return [...acc.values()]
    .filter((r) => r.taxable !== 0 || r.qty !== 0)
    .sort((a, b) => a.hsn.localeCompare(b.hsn) || a.rate - b.rate)
    .map((r, i) => ({
      hsn_sc: r.hsn,
      num: i + 1,
      desc: r.desc,
      uqc: isService(r.hsn) ? 'NA' : 'NOS',
      // The portal refuses a negative quantity (a month of more returns than sales).
      qty: isService(r.hsn) ? 0 : Math.max(0, r.qty),
      rt: r.rate,
      txval: rupees(r.taxable),
      iamt: rupees(r.igst),
      camt: rupees(r.cgst),
      samt: rupees(r.sgst),
      csamt: 0,
    }))
}

/** Table 13: per document type and series, first and last number, issued and cancelled. */
function docIssue(docs: readonly Gstr1Document[]): Gstr1DocDet[] {
  return (Object.keys(DOC_NUM) as (keyof typeof DOC_NUM)[]).flatMap((kind) => {
    const ofKind = docs.filter((d) => d.kind === kind)
    if (ofKind.length === 0) return []
    const series = [...groupBy(ofKind, (d) => d.series).entries()].sort(([a], [b]) =>
      a.localeCompare(b),
    )
    return [
      {
        doc_num: DOC_NUM[kind],
        docs: series.map(([, list], i) => {
          const sorted = [...list].sort((a, b) => a.seq - b.seq)
          const cancel = sorted.filter((d) => d.cancelled).length
          return {
            num: i + 1,
            from: sorted[0]?.number ?? '',
            to: sorted.at(-1)?.number ?? '',
            totnum: sorted.length,
            cancel,
            net_issue: sorted.length - cancel,
          }
        }),
      },
    ]
  })
}

/**
 * One GSTIN's GSTR-1 for a month. Invoices to a GSTIN go to B2B, inter-state ones to
 * unregistered buyers over ₹1 lakh to B2CL, exports to EXP, the rest are summed into B2CS by
 * place of supply and rate. Credit notes against B2B go to CDNR, against B2CL or an export to
 * CDNUR, and against a B2CS invoice are netted into B2CS (the portal has no note table for
 * B2C small). Table 12 nets every note too and splits by B2B and B2C. Empty tables are left
 * out, as the offline tool does.
 */
export function buildGstr1Json(input: Gstr1JsonInput): Gstr1Json {
  const ownState = input.gstin.slice(0, 2)
  const b2b: { ctin: string; inv: Gstr1B2bInvoice }[] = []
  const b2cl: { pos: string; inv: Gstr1B2clInvoice }[] = []
  const exp: { exp_typ: 'WPAY' | 'WOPAY'; inv: Gstr1ExpInvoice }[] = []
  const b2cs = new Map<string, Gstr1B2csRow & { paise: number[] }>()
  const nil = new Map<Gstr1NilRow['sply_ty'], number>()
  const hsnB2b: { line: DocumentLine; sign: 1 | -1 }[] = []
  const hsnB2c: { line: DocumentLine; sign: 1 | -1 }[] = []

  const addNil = (inv: Gstr1Invoice, rows: readonly TaxRow[], sign: 1 | -1) => {
    const type = `${inv.interState ? 'INTR' : 'INTRA'}${inv.buyerGstin ? 'B2B' : 'B2C'}` as const
    for (const r of rows) {
      if (r.ratePercent > 0) continue
      nil.set(type, (nil.get(type) ?? 0) + sign * r.taxablePaise)
    }
  }
  const addSmall = (inv: Gstr1Invoice, rows: readonly TaxRow[], sign: 1 | -1) => {
    const pos = posOf(inv, ownState)
    const sply_ty = inv.interState ? 'INTER' : 'INTRA'
    for (const r of rows) {
      if (r.ratePercent <= 0) continue
      const key = `${sply_ty}|${pos}|${r.ratePercent}`
      const row = b2cs.get(key) ?? {
        sply_ty,
        pos,
        typ: 'OE' as const,
        rt: r.ratePercent,
        txval: 0,
        iamt: 0,
        camt: 0,
        samt: 0,
        csamt: 0,
        paise: [0, 0, 0, 0],
      }
      const [t = 0, ig = 0, cg = 0, sg = 0] = row.paise
      row.paise = [
        t + sign * r.taxablePaise,
        ig + sign * r.igstPaise,
        cg + sign * r.cgstPaise,
        sg + sign * r.sgstPaise,
      ]
      b2cs.set(key, row)
    }
  }

  for (const inv of input.invoices) {
    const bucket = gstr1Bucket(inv)
    ;(bucket === 'b2b' ? hsnB2b : hsnB2c).push(
      ...inv.lines.map((line) => ({ line, sign: 1 as const })),
    )
    if (inv.export) {
      const x = inv.export
      const sbnum = x.shippingBillNumber ? Number(x.shippingBillNumber) : Number.NaN
      exp.push({
        exp_typ: x.type,
        inv: {
          inum: inv.number,
          idt: jsonDate(inv.issuedAt),
          val: rupees(inv.totalPaise),
          ...(x.portCode ? { sbpcode: x.portCode } : {}),
          ...(Number.isInteger(sbnum) ? { sbnum } : {}),
          ...(x.shippingBillDate ? { sbdt: jsonDate(new Date(x.shippingBillDate)) } : {}),
          itms: inv.taxSummary.map((r) => ({
            txval: rupees(r.taxablePaise),
            rt: r.ratePercent,
            iamt: x.type === 'WPAY' ? rupees(r.igstPaise) : 0,
            csamt: 0,
          })),
        },
      })
      continue
    }
    addNil(inv, inv.taxSummary, 1)
    if (bucket === 'b2cs') {
      addSmall(inv, inv.taxSummary, 1)
      continue
    }
    const itms = items(inv.taxSummary, bucket === 'b2b')
    // An invoice that is nil-rated throughout is reported in Table 8 only.
    if (itms.length === 0) continue
    const head = { inum: inv.number, idt: jsonDate(inv.issuedAt), val: rupees(inv.totalPaise) }
    if (bucket === 'b2b') {
      b2b.push({
        ctin: (inv.buyerGstin ?? '').toUpperCase(),
        inv: { ...head, pos: posOf(inv, ownState), rchrg: 'N', inv_typ: 'R', itms },
      })
    } else {
      b2cl.push({ pos: posOf(inv, ownState), inv: { ...head, itms } })
    }
  }

  const cdnr: { ctin: string; nt: Gstr1CdnrNote }[] = []
  const cdnur: Gstr1CdnurNote[] = []
  for (const cn of input.creditNotes) {
    const orig = cn.invoice
    const bucket = gstr1Bucket(orig)
    ;(bucket === 'b2b' ? hsnB2b : hsnB2c).push(
      ...cn.lines.map((line) => ({ line, sign: -1 as const })),
    )
    if (!orig.export) addNil(orig, cn.taxSummary, -1)
    if (bucket === 'b2cs') {
      addSmall(orig, cn.taxSummary, -1)
      continue
    }
    const note = { ntty: 'C' as const, nt_num: cn.number, nt_dt: jsonDate(cn.issuedAt) }
    const val = rupees(cn.totalPaise)
    if (bucket === 'b2b') {
      const itms = items(cn.taxSummary, true)
      if (itms.length === 0) continue
      cdnr.push({
        ctin: (orig.buyerGstin ?? '').toUpperCase(),
        nt: { ...note, val, pos: posOf(orig, ownState), rchrg: 'N', inv_typ: 'R', itms },
      })
    } else if (orig.export) {
      cdnur.push({
        typ: orig.export.type === 'WPAY' ? 'EXPWP' : 'EXPWOP',
        ...note,
        val,
        itms: cn.taxSummary.map((r, i) => ({
          num: i + 1,
          itm_det: {
            rt: r.ratePercent,
            txval: rupees(r.taxablePaise),
            iamt: orig.export?.type === 'WPAY' ? rupees(r.igstPaise) : 0,
            csamt: 0,
          },
        })),
      })
    } else {
      const itms = items(cn.taxSummary, false)
      if (itms.length === 0) continue
      cdnur.push({ typ: 'B2CL', ...note, val, pos: posOf(orig, ownState), itms })
    }
  }

  const b2csRows = [...b2cs.values()]
    .filter((r) => r.paise.some((p) => p !== 0))
    .sort((a, b) => a.pos.localeCompare(b.pos) || a.rt - b.rt || a.sply_ty.localeCompare(b.sply_ty))
    .map(({ paise: [t = 0, ig = 0, cg = 0, sg = 0], ...r }) => ({
      ...r,
      txval: rupees(t),
      iamt: rupees(ig),
      camt: rupees(cg),
      samt: rupees(sg),
    }))
  const nilRows = (['INTRB2B', 'INTRAB2B', 'INTRB2C', 'INTRAB2C'] as const).flatMap((sply_ty) => {
    const paise = nil.get(sply_ty) ?? 0
    // A 0% rate is reported as nil-rated: the snapshot does not tell nil-rated from exempt.
    return paise !== 0 ? [{ sply_ty, nil_amt: rupees(paise), expt_amt: 0, ngsup_amt: 0 }] : []
  })

  const grouped = <T, K extends string, V>(rows: T[], key: (r: T) => K, val: (r: T) => V) =>
    [...groupBy(rows, key).entries()].map(([k, list]) => ({ k, list: list.map(val) }))

  return {
    gstin: input.gstin,
    fp: filingPeriod(input.period),
    version: GSTR1_JSON_VERSION,
    hash: 'hash',
    ...(b2b.length
      ? {
          b2b: grouped(
            b2b,
            (r) => r.ctin,
            (r) => r.inv,
          ).map(({ k, list }) => ({ ctin: k, inv: list })),
        }
      : {}),
    ...(b2cl.length
      ? {
          b2cl: grouped(
            b2cl,
            (r) => r.pos,
            (r) => r.inv,
          ).map(({ k, list }) => ({ pos: k, inv: list })),
        }
      : {}),
    ...(b2csRows.length ? { b2cs: b2csRows } : {}),
    ...(exp.length
      ? {
          exp: grouped(
            exp,
            (r) => r.exp_typ,
            (r) => r.inv,
          ).map(({ k, list }) => ({ exp_typ: k, inv: list })),
        }
      : {}),
    ...(cdnr.length
      ? {
          cdnr: grouped(
            cdnr,
            (r) => r.ctin,
            (r) => r.nt,
          ).map(({ k, list }) => ({ ctin: k, nt: list })),
        }
      : {}),
    ...(cdnur.length ? { cdnur } : {}),
    ...(nilRows.length ? { nil: { inv: nilRows } } : {}),
    hsn: { hsn_b2b: hsnRows(hsnB2b), hsn_b2c: hsnRows(hsnB2c) },
    doc_issue: { doc_det: docIssue(input.documents) },
  }
}
