/** SOURCE OF TRUTH: purchase order sheet (PO PDF + supplier email)
 * WHAT:  The plain data a printed purchase order shows: buyer, ship-to, supplier, lines in the
 *        order's own currency, and the labels both the PDF and the email to the supplier print.
 * WHY:   One shape for the PDF template (`@commerce/invoices`, which core cannot import) and
 *        the email, so both always say the same thing. No database here; the loader is
 *        `po-sheet-load.ts`.
 * WHERE: Admin purchase order page → Print / Email to supplier.
 */
import { formatInZone } from '@commerce/dates'
import { formatNumber } from '@commerce/money'
import { currencyDigits } from './landed-cost'
import type { PurchaseOrderStatus } from './stock'

/** A name and address block. */
export type PoSheetParty = {
  name: string
  gstin: string | null
  /** Printed one per line; the last is "City, State, PIN". */
  address: string[]
  email: string | null
  phone: string | null
}

export type PoSheetLine = {
  /** Unique on an order (one line per variant). */
  variantId: string
  /** "Pad / Black", or the product title when it has one variant. */
  title: string
  sku: string | null
  hsnCode: string | null
  quantity: number
  /** In the order's currency's minor units (cents, fen, paise). */
  unitPriceMinor: number
  totalMinor: number
}

export type PurchaseOrderSheet = {
  number: number
  status: PurchaseOrderStatus
  /** The day it was marked ordered, else the day the draft was made: "10 Oct 2026". */
  dateLabel: string
  /** "15 Nov 2026", or null when no arrival date is set. */
  expectedLabel: string | null
  currency: string
  /** The store (its GST registration for the destination, when there is one). */
  buyer: PoSheetParty
  /** The receiving location. */
  shipTo: PoSheetParty
  supplier: PoSheetParty
  paymentTerms: string | null
  note: string | null
  lines: PoSheetLine[]
  units: number
  /** Goods only: freight, duty and other charges are the store's own costs, not the supplier's bill. */
  totalMinor: number
}

/** "PO7": the number the admin, the PDF and the email all print. */
export const poNumberLabel = (n: number): string => `PO${n}`

export const poFilename = (n: number): string => `purchase-order-${poNumberLabel(n)}.pdf`

/** "₹1,234.00" for rupees, "USD 1,234.50" or "JPY 12,000" for the rest, always with full decimals. */
export function formatPurchaseAmount(minor: number, currency: string): string {
  const digits = currencyDigits(currency)
  const amount = formatNumber(minor / 10 ** digits, {
    locale: 'en-IN',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
  return currency === 'INR' ? `₹${amount}` : `${currency} ${amount}`
}

/** "10 Oct 2026" in the store's time zone. */
export function poDateLabel(at: Date, timeZone: string): string {
  return formatInZone(at, { day: 'numeric', month: 'short', year: 'numeric' }, { timeZone })
}

/** Every bit of text on the sheet, so the PDF can pick fonts for the scripts it holds (Hindi, Chinese). */
export function poSheetText(sheet: PurchaseOrderSheet): string {
  const party = (p: PoSheetParty) => [p.name, ...p.address].join(' ')
  return [
    party(sheet.buyer),
    party(sheet.shipTo),
    party(sheet.supplier),
    sheet.paymentTerms ?? '',
    sheet.note ?? '',
    ...sheet.lines.map((l) => l.title),
  ].join(' ')
}
