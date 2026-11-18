/**
 * SOURCE OF TRUTH: salesRegister — WHAT: one GSTIN's month as the CA's sales register (goods,
 * service, international, credit notes, summary), as plain rows / WHY: the merchant used to
 * build this Excel file by hand every month; the xlsx itself is `./sales-register-xlsx.ts`.
 *
 * Conventions (mirrors the CA's own file, with its known faults fixed):
 * - one row per invoice line; delivery charges are their own row under SAC 996819;
 * - only documents dated in the month (no stray earlier-month invoice);
 * - cancelled invoices are left out of the tabs and totals and listed on the Summary, as
 *   GSTR-1 Table 13 counts them;
 * - the line's own total and the invoice total are separate columns.
 */
import { wallClock } from '@commerce/dates'
import type { StoreTx } from '@commerce/db'
import {
  type DocumentLine,
  type DocumentSnapshot,
  DocumentSnapshotSchema,
  financialYear,
  formatSeriesNumber,
  type InvoiceSettings,
  pickSeries,
  type Series,
} from '@commerce/invoices'
import { and, asc, eq, gte, inArray, lt } from 'drizzle-orm'
import { loadSettings } from './issue'
import { peekNext } from './next-number'
import { periodRange } from './periods'
import { documentSeriesKey } from './record-external'
import { documentIssuer, gstToken, sameRegistration } from './registration'
import { invoice } from './schema'

/** SAC for goods transport / delivery charges, as the CA's register books freight. */
const FREIGHT_SAC = '996819'

type InvoiceRow = typeof invoice.$inferSelect

export type RegisterLine = {
  /** Calendar day in IST, as a UTC midnight Date (Excel dates carry no zone). */
  date: Date
  number: string
  party: string
  gstin: string
  hsn: string
  quantity: number
  /** 0.18 for 18%. */
  rate: number
  lineTotal: number
  taxable: number
  cgst: number
  sgst: number
  igst: number
  b2b: 'B2B' | 'B2C'
  state: string
  note: string
  /** On the invoice's first row only, so a column sum is the sum of invoices. */
  invoiceTotal: number | null
}

export type ExportLine = RegisterLine & {
  country: string
  currency: string
  exchangeRate: number | null
  lutNumber: string
  exportType: string
  portCode: string
  shippingBillNo: string
  shippingBillDate: Date | null
}

export type RegisterCreditNote = {
  date: Date
  number: string
  originalNumber: string
  originalDate: Date | null
  party: string
  gstin: string
  placeOfSupply: string
  supply: 'Domestic' | 'Export'
  taxable: number
  cgst: number
  sgst: number
  igst: number
  total: number
  reason: string
}

export type RegisterTotals = {
  label: string
  count: number
  taxable: number
  cgst: number
  sgst: number
  igst: number
  total: number
}

export type SeriesRange = {
  series: string
  first: string
  last: string
  issued: number
  cancelled: number
}

export type SalesRegister = {
  period: string
  gstin: string
  legalName: string
  goods: RegisterLine[]
  service: RegisterLine[]
  international: ExportLine[]
  creditNotes: RegisterCreditNote[]
  totals: RegisterTotals[]
  ranges: SeriesRange[]
  cancelled: string[]
  /** The numbering switch, while the financial year has numbers from both systems. */
  note: string | null
}

const rupees = (paise: number) => Math.round(paise) / 100

/** The IST calendar day of an instant, as a UTC-midnight Date for the sheet. */
function sheetDay(at: Date): Date {
  const wall = wallClock(at)
  return new Date(Date.UTC(wall.getUTCFullYear(), wall.getUTCMonth(), wall.getUTCDate()))
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** `01-Oct-2026`, the way the CA's file prints dates (IST calendar day). */
function registerDate(at: Date): string {
  const d = sheetDay(at)
  const dd = String(d.getUTCDate()).padStart(2, '0')
  return `${dd}-${MONTHS[d.getUTCMonth()]}-${d.getUTCFullYear()}`
}

const isService = (doc: DocumentSnapshot) => {
  const goods = doc.lines.filter((l) => !l.charge)
  return goods.length > 0 && goods.every((l) => l.hsn.startsWith('99'))
}

const isDelivery = (l: DocumentLine) => l.charge && /^shipping|deliver|freight/i.test(l.description)

function lineRows(row: InvoiceRow, doc: DocumentSnapshot): RegisterLine[] {
  const gstin = doc.buyer.gstin ?? ''
  return doc.lines.map((l, i) => {
    const freight = isDelivery(l)
    const note = freight
      ? `Delivery / freight (${l.ratePercent}%)${l.hsn === FREIGHT_SAC ? '' : `, billed under HSN ${l.hsn} on the invoice`}`
      : l.charge
        ? l.description
        : ''
    return {
      date: sheetDay(row.invoiceDate ?? row.issuedAt),
      number: row.number ?? '',
      party: doc.buyer.name,
      gstin,
      hsn: freight ? FREIGHT_SAC : l.hsn,
      quantity: l.quantity,
      rate: l.ratePercent / 100,
      lineTotal: rupees(l.totalPaise),
      taxable: rupees(l.taxablePaise),
      cgst: rupees(l.cgstPaise),
      sgst: rupees(l.sgstPaise),
      igst: rupees(l.igstPaise),
      b2b: gstin ? 'B2B' : 'B2C',
      state: doc.placeOfSupply?.name ?? '',
      note,
      invoiceTotal: i === 0 ? rupees(row.totalPaise) : null,
    }
  })
}

function exportRows(row: InvoiceRow, doc: DocumentSnapshot, settings: InvoiceSettings) {
  const exp = doc.exportSupply
  const lut = row.supplyType === 'export_lut' || exp?.mode === 'lut'
  const billDate = row.shippingBillDate ?? exp?.shippingBillDate ?? null
  return lineRows(row, doc).map(
    (l): ExportLine => ({
      ...l,
      state: doc.placeOfSupply?.name ?? 'Outside India',
      country: exp?.countryName ?? exp?.country ?? '',
      currency: row.currency ?? exp?.currency ?? '',
      exchangeRate:
        row.exchangeRate !== null ? Number(row.exchangeRate) : (exp?.exchangeRate ?? null),
      lutNumber: lut ? exp?.lutNumber || settings.lutNumber : '',
      exportType: lut ? 'Without payment of IGST (LUT)' : 'With payment of IGST',
      portCode: row.portCode ?? exp?.portCode ?? '',
      shippingBillNo: row.shippingBillNo ?? exp?.shippingBillNumber ?? '',
      shippingBillDate: billDate ? new Date(`${billDate.slice(0, 10)}T00:00:00Z`) : null,
    }),
  )
}

function totalsOf(label: string, rows: readonly InvoiceRow[], sign = 1): RegisterTotals {
  const sum = (pick: (r: InvoiceRow) => number) =>
    (sign * rows.reduce((a, r) => a + pick(r), 0)) / 100
  return {
    label,
    count: rows.length,
    taxable: sum((r) => r.taxablePaise),
    cgst: sum((r) => r.cgstPaise),
    sgst: sum((r) => r.sgstPaise),
    igst: sum((r) => r.igstPaise),
    total: sum((r) => r.totalPaise),
  }
}

function rangesOf(rows: readonly InvoiceRow[], settings: InvoiceSettings): SeriesRange[] {
  const bySeries = new Map<string, InvoiceRow[]>()
  for (const r of rows) {
    if (!r.number || r.seq === null) continue
    const key = documentSeriesKey(r)
    bySeries.set(key, [...(bySeries.get(key) ?? []), r])
  }
  return [...bySeries.entries()].map(([id, list]) => {
    const sorted = [...list].sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0))
    return {
      series: settings.series.find((s) => s.id === id)?.name ?? id,
      first: sorted[0]?.number ?? '',
      last: sorted.at(-1)?.number ?? '',
      issued: sorted.length,
      cancelled: sorted.filter((r) => r.status === 'cancelled').length,
    }
  })
}

/** `INV/26-27/NNNN`: a series' numbers with the running part shown as N. */
function patternOf(series: Series, fy: ReturnType<typeof financialYear>, token: string) {
  return `${formatSeriesNumber(series, fy, 0, token).slice(0, -series.pad)}${'N'.repeat(series.pad)}`
}

/** First number of a series this financial year for one GSTIN, issued or cancelled. */
async function firstOfYear(
  tx: StoreTx,
  gst: string | null,
  seriesId: string,
  fyStartYear: number,
): Promise<InvoiceRow | null> {
  const [row] = await tx
    .select()
    .from(invoice)
    .where(
      and(
        sameRegistration(invoice.gstRegistrationId, gst),
        eq(invoice.seriesId, seriesId),
        eq(invoice.fyStartYear, fyStartYear),
        inArray(invoice.status, ['issued', 'cancelled']),
      ),
    )
    .orderBy(asc(invoice.seq))
    .limit(1)
  return row ?? null
}

/**
 * "From 05-Nov-2026 invoices are numbered INV/26-27/NNNN (previously VI/26-27/…). Export
 * invoices continue EXP/26-27/0002 after VI/EXP/26-27/001." Only for a financial year whose
 * domestic series carries on from a previous system (`Series.carriedFrom`) and already has a
 * Koomerce invoice; the switch date is that series' first invoice of the year.
 */
async function numberingNote(
  tx: StoreTx,
  gst: string | null,
  settings: InvoiceSettings,
  token: string,
  at: Date,
): Promise<string | null> {
  const fy = financialYear(at)
  const domestic = pickSeries(settings.series, 'tax_invoice', { export: false, b2b: false })
  if (!domestic || domestic.carriedFrom?.fyStartYear !== fy.startYear) return null
  const first = await firstOfYear(tx, gst, domestic.id, fy.startYear)
  if (!first) return null
  const previous = `${domestic.carriedFrom.last.replace(/\d+$/, '')}…`
  let note = `From ${registerDate(first.invoiceDate ?? first.issuedAt)} invoices are numbered ${patternOf(domestic, fy, token)} (previously ${previous}).`
  const exp = pickSeries(settings.series, 'tax_invoice', { export: true, b2b: false })
  if (exp?.carriedFrom?.fyStartYear === fy.startYear) {
    const firstExport = await firstOfYear(tx, gst, exp.id, fy.startYear)
    const year = exp.resetEachYear === false ? 0 : fy.startYear
    const continues =
      firstExport?.number ??
      formatSeriesNumber(exp, fy, await peekNext(tx, gst, exp.id, year), token)
    note += ` Export invoices continue ${continues} after ${exp.carriedFrom.last}.`
  }
  return note
}

/** One GSTIN's sales register for a month (`2026-10`); `gst` null is a store without one. */
export async function salesRegister(
  tx: StoreTx,
  storeId: string,
  period: string,
  gst: string | null,
): Promise<SalesRegister> {
  const { from, to } = periodRange(period)
  const settings = await loadSettings(tx, storeId)
  const issuer = await documentIssuer(tx, gst)
  const rows = await tx
    .select()
    .from(invoice)
    .where(
      and(
        sameRegistration(invoice.gstRegistrationId, gst),
        inArray(invoice.kind, ['tax_invoice', 'credit_note']),
        inArray(invoice.status, ['issued', 'cancelled']),
        gte(invoice.invoiceDate, from),
        lt(invoice.invoiceDate, to),
      ),
    )
    .orderBy(asc(invoice.invoiceDate), asc(invoice.seq))
  const snap = (r: InvoiceRow) => DocumentSnapshotSchema.parse(r.snapshot)
  const live = rows.filter((r) => r.status === 'issued')
  const invoices = live.filter((r) => r.kind === 'tax_invoice')
  const notes = live.filter((r) => r.kind === 'credit_note')

  // An export is zero-rated by its snapshot (or the row's supply type on newer rows).
  const isExport = (r: InvoiceRow) => r.supplyType !== 'domestic' || snap(r).exportSupply !== null
  const exportRowsIn = invoices.filter(isExport)
  const domesticRows = invoices.filter((r) => !isExport(r))
  const serviceRows = domesticRows.filter((r) => isService(snap(r)))
  const goodsRows = domesticRows.filter((r) => !serviceRows.includes(r))

  const creditNotes = notes.map((r): RegisterCreditNote => {
    const doc = snap(r)
    return {
      date: sheetDay(r.invoiceDate ?? r.issuedAt),
      number: r.number ?? '',
      originalNumber: doc.original?.number ?? '',
      originalDate: doc.original ? sheetDay(new Date(doc.original.issuedAt)) : null,
      party: doc.buyer.name,
      gstin: doc.buyer.gstin ?? '',
      placeOfSupply: doc.placeOfSupply?.name ?? '',
      supply: isExport(r) ? 'Export' : 'Domestic',
      taxable: rupees(r.taxablePaise),
      cgst: rupees(r.cgstPaise),
      sgst: rupees(r.sgstPaise),
      igst: rupees(r.igstPaise),
      total: rupees(r.totalPaise),
      reason: doc.reason ?? '',
    }
  })

  const parts = [
    totalsOf('Goods', goodsRows),
    totalsOf('Service', serviceRows),
    totalsOf('International', exportRowsIn),
  ]
  const less = totalsOf('Less: credit notes', notes, -1)
  const sumOf = (k: 'taxable' | 'cgst' | 'sgst' | 'igst' | 'total') =>
    [...parts, less].reduce((a, p) => a + Math.round(p[k] * 100), 0) / 100
  const net: RegisterTotals = {
    label: 'Net of credit notes',
    count: parts.reduce((a, p) => a + p.count, 0),
    taxable: sumOf('taxable'),
    cgst: sumOf('cgst'),
    sgst: sumOf('sgst'),
    igst: sumOf('igst'),
    total: sumOf('total'),
  }

  const token = gstToken(issuer, settings)
  return {
    period,
    gstin: issuer?.gstin ?? settings.seller.gstin,
    legalName: settings.seller.legalName,
    goods: goodsRows.flatMap((r) => lineRows(r, snap(r))),
    service: serviceRows.flatMap((r) => lineRows(r, snap(r))),
    international: exportRowsIn.flatMap((r) => exportRows(r, snap(r), settings)),
    creditNotes,
    totals: [...parts, less, net],
    ranges: rangesOf(rows, settings),
    cancelled: rows.filter((r) => r.status === 'cancelled' && r.number).map((r) => r.number ?? ''),
    note: await numberingNote(tx, gst, settings, token, from),
  }
}
