/**
 * SOURCE OF TRUTH: salesRegisterXlsx — WHAT: a {@link SalesRegister} as the .xlsx the CA gets
 * (Goods, Service, International, Credit Notes, Summary) / WHY: same columns, order, header
 * look and formats as the merchant's hand-made file, but amounts are numbers (never text)
 * and the line total is labelled as such. Written with write-excel-file (MIT).
 */
import { formatInZone } from '@commerce/dates'
import writeXlsxFile, { type Cell, type Row, type Sheet } from 'write-excel-file/node'
import type {
  ExportLine,
  RegisterCreditNote,
  RegisterLine,
  RegisterTotals,
  SalesRegister,
} from './sales-register'

const MONEY = '#,##0.00'
const DATE = 'dd-mmm-yyyy'
const HEADER_FILL = '#D9E1F2'

/** The CA's Sales Register headers, in their order; column I relabelled, invoice total added. */
export const GOODS_HEADERS = [
  'S. No.',
  'INVOICE DATE',
  'INVOICE NO',
  'PARTY NAME',
  'PARTY GST NO',
  'HSN/SAC CODE',
  'QTY.',
  'TAX RATE',
  'LINE TOTAL (TAXABLE + GST)',
  'TAXABLE VALUE',
  'CGST',
  'SGST',
  'IGST',
  'B2B/B2C',
  'STATE',
  'AUDIT NOTES',
  'INVOICE TOTAL',
] as const

/** The CA's Service Register: the same, without audit notes, and `S.No`. */
export const SERVICE_HEADERS = ['S.No', ...GOODS_HEADERS.slice(1, 15), 'INVOICE TOTAL'] as const

export const INTERNATIONAL_HEADERS = [
  ...GOODS_HEADERS,
  'COUNTRY',
  'CURRENCY',
  'EXCHANGE RATE',
  'LUT NUMBER',
  'EXPORT TYPE',
  'PORT CODE',
  'SHIPPING BILL NO.',
  'SHIPPING BILL DATE',
] as const

export const CREDIT_NOTE_HEADERS = [
  'S. No.',
  'CREDIT NOTE DATE',
  'CREDIT NOTE NO',
  'ORIGINAL INVOICE NO',
  'ORIGINAL INVOICE DATE',
  'PARTY NAME',
  'PARTY GST NO',
  'PLACE OF SUPPLY',
  'DOMESTIC/EXPORT',
  'TAXABLE VALUE',
  'CGST',
  'SGST',
  'IGST',
  'TOTAL',
  'REASON',
] as const

export const SUMMARY_HEADERS = [
  'TAB',
  'DOCUMENTS',
  'TAXABLE VALUE',
  'CGST',
  'SGST',
  'IGST',
  'TOTAL',
] as const

/** Column widths of the CA's file (characters), then ours for the added columns. */
const GOODS_WIDTHS = [6, 13, 15, 26, 19, 13, 6, 9, 18, 15, 12, 12, 12, 9, 22, 34, 15]
const EXTRA_WIDTHS = [16, 10, 13, 20, 30, 10, 16, 16]
const NOTE_WIDTHS = [6, 14, 16, 18, 16, 26, 19, 18, 14, 15, 12, 12, 12, 14, 30]

const header = (labels: readonly string[]): Row =>
  labels.map((value) => ({
    value,
    fontWeight: 'bold',
    backgroundColor: HEADER_FILL,
    align: 'center',
    wrap: true,
  }))

const text = (value: string): Cell => (value ? { value, type: String } : null)
const money = (value: number | null): Cell =>
  value === null ? null : { value, type: Number, format: MONEY }
const day = (value: Date | null): Cell => (value ? { value, type: Date, format: DATE } : null)
const bold = (cell: Cell): Cell =>
  cell && typeof cell === 'object' && !(cell instanceof Date) && 'value' in cell
    ? { ...cell, fontWeight: 'bold' }
    : cell

/** HSN as a number like the CA's file, unless a leading zero would be lost. */
const hsnCell = (hsn: string): Cell =>
  /^[1-9][0-9]*$/.test(hsn) ? { value: Number(hsn), type: Number } : text(hsn)

function lineCells(l: RegisterLine, n: number, withNote: boolean): Cell[] {
  return [
    { value: n, type: Number },
    day(l.date),
    text(l.number),
    text(l.party),
    text(l.gstin),
    hsnCell(l.hsn),
    { value: l.quantity, type: Number },
    { value: l.rate, type: Number, format: '0%' },
    money(l.lineTotal),
    money(l.taxable),
    money(l.cgst),
    money(l.sgst),
    money(l.igst),
    text(l.b2b),
    text(l.state),
    ...(withNote ? [text(l.note)] : []),
    money(l.invoiceTotal),
  ]
}

const sum = (rows: readonly { [k: string]: unknown }[], key: string) =>
  rows.reduce((a, r) => a + Math.round(Number(r[key] ?? 0) * 100), 0) / 100

/** The CA's TOTAL row: label under TAX RATE, sums under the amount columns. */
function totalRow(lines: readonly RegisterLine[], width: number, withNote: boolean): Row {
  const row: Cell[] = Array.from({ length: width }, () => null)
  row[7] = { value: 'TOTAL', fontWeight: 'bold' }
  ;(['lineTotal', 'taxable', 'cgst', 'sgst', 'igst'] as const).forEach((k, i) => {
    row[8 + i] = bold(money(sum(lines, k)))
  })
  row[withNote ? 16 : 15] = bold(money(sum(lines, 'invoiceTotal')))
  return row
}

function lineSheet(
  name: string,
  headers: readonly string[],
  lines: readonly RegisterLine[],
  withNote: boolean,
  empty: string,
): Sheet<never> {
  const data: Row[] = [header(headers)]
  if (lines.length === 0) data.push([text(empty)])
  else {
    lines.forEach((l, i) => {
      data.push(lineCells(l, i + 1, withNote))
    })
    data.push(totalRow(lines, headers.length, withNote))
  }
  const widths = withNote ? GOODS_WIDTHS : GOODS_WIDTHS.filter((_, i) => i !== 15)
  return { sheet: name, data, columns: widths.map((width) => ({ width })), stickyRowsCount: 1 }
}

function internationalSheet(lines: readonly ExportLine[], empty: string): Sheet<never> {
  const data: Row[] = [header(INTERNATIONAL_HEADERS)]
  if (lines.length === 0) data.push([text(empty)])
  else {
    lines.forEach((l, i) => {
      data.push([
        ...lineCells(l, i + 1, true),
        text(l.country),
        text(l.currency),
        l.exchangeRate === null ? null : { value: l.exchangeRate, type: Number, format: '0.0000' },
        text(l.lutNumber),
        text(l.exportType),
        text(l.portCode),
        text(l.shippingBillNo),
        day(l.shippingBillDate),
      ])
    })
    data.push(totalRow(lines, INTERNATIONAL_HEADERS.length, true))
  }
  return {
    sheet: 'International',
    data,
    columns: [...GOODS_WIDTHS, ...EXTRA_WIDTHS].map((width) => ({ width })),
    stickyRowsCount: 1,
  }
}

function creditNoteSheet(notes: readonly RegisterCreditNote[], empty: string): Sheet<never> {
  const data: Row[] = [header(CREDIT_NOTE_HEADERS)]
  if (notes.length === 0) data.push([text(empty)])
  else {
    notes.forEach((c, i) => {
      data.push([
        { value: i + 1, type: Number },
        day(c.date),
        text(c.number),
        text(c.originalNumber),
        day(c.originalDate),
        text(c.party),
        text(c.gstin),
        text(c.placeOfSupply),
        text(c.supply),
        money(c.taxable),
        money(c.cgst),
        money(c.sgst),
        money(c.igst),
        money(c.total),
        text(c.reason),
      ])
    })
    const total: Cell[] = Array.from({ length: CREDIT_NOTE_HEADERS.length }, () => null)
    total[8] = { value: 'TOTAL', fontWeight: 'bold' }
    ;(['taxable', 'cgst', 'sgst', 'igst', 'total'] as const).forEach((k, i) => {
      total[9 + i] = bold(money(sum(notes, k)))
    })
    data.push(total)
  }
  return {
    sheet: 'Credit Notes',
    data,
    columns: NOTE_WIDTHS.map((width) => ({ width })),
    stickyRowsCount: 1,
  }
}

const totalsCells = (t: RegisterTotals, strong: boolean): Row =>
  [
    text(t.label),
    { value: t.count, type: Number },
    money(t.taxable),
    money(t.cgst),
    money(t.sgst),
    money(t.igst),
    money(t.total),
  ].map((c) => (strong ? bold(c) : c))

function summarySheet(r: SalesRegister, monthName: string): Sheet<never> {
  const data: Row[] = [
    [{ value: `Sales register, ${monthName}`, fontWeight: 'bold', fontSize: 14 }],
    [text([r.legalName, r.gstin ? `GSTIN ${r.gstin}` : ''].filter(Boolean).join(' · '))],
    [],
    header(SUMMARY_HEADERS),
    ...r.totals.map((t, i) => totalsCells(t, i === r.totals.length - 1)),
    [],
    header(['SERIES', 'FROM', 'TO', 'NUMBERS USED', 'CANCELLED']),
    ...(r.ranges.length
      ? r.ranges.map(
          (s): Row => [
            text(s.series),
            text(s.first),
            text(s.last),
            { value: s.issued, type: Number },
            { value: s.cancelled, type: Number },
          ],
        )
      : [[text('No numbers used this month')]]),
    [],
    header(['CANCELLED INVOICES (LEFT OUT OF THE TABS AND TOTALS)']),
    ...(r.cancelled.length ? r.cancelled.map((n): Row => [text(n)]) : [[text('None')]]),
  ]
  if (r.note) data.push([], [{ value: 'NOTE', fontWeight: 'bold' }, text(r.note)])
  return {
    sheet: 'Summary',
    data,
    columns: [26, 20, 20, 14, 12, 14, 16].map((width) => ({ width })),
  }
}

/** "October 2026" for `2026-10`. */
function monthName(period: string): string {
  const [y, m] = period.split('-').map(Number) as [number, number]
  return formatInZone(
    new Date(Date.UTC(y, m - 1, 15)),
    { month: 'long', year: 'numeric' },
    { locale: 'en-GB' },
  )
}

/** The register as .xlsx bytes. */
export async function salesRegisterXlsx(r: SalesRegister): Promise<Uint8Array> {
  const month = monthName(r.period)
  const sheets = [
    lineSheet('Goods', GOODS_HEADERS, r.goods, true, `No goods invoices dated in ${month}.`),
    lineSheet(
      'Service',
      SERVICE_HEADERS,
      r.service,
      false,
      `No service invoices dated in ${month}.`,
    ),
    internationalSheet(r.international, `No export invoices dated in ${month}.`),
    creditNoteSheet(r.creditNotes, `No credit notes dated in ${month}.`),
    summarySheet(r, month),
  ]
  const buffer = await writeXlsxFile(sheets).toBuffer()
  return new Uint8Array(buffer)
}

/** `SalesRegister_06AAAAA0000A1Z5_102026.xlsx`. */
export function salesRegisterFilename(r: SalesRegister): string {
  const mmyyyy = `${r.period.slice(5, 7)}${r.period.slice(0, 4)}`
  return `SalesRegister_${r.gstin || 'store'}_${mmyyyy}.xlsx`
}
