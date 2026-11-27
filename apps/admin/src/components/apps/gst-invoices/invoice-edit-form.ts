/**
 * The "Edit invoice" sheet's form as typed (rupee strings, so "12." survives), its conversion
 * to the API's `InvoiceEdit` in paise, and the filing reminder's window. Pure and client-safe.
 */
import { IST_OFFSET_MS } from '@commerce/dates'
import type { InvoiceEdit } from '@commerce/invoices'
import { monthRange } from './return-months'

export type EditForm = {
  lines: { quantity: string; unitPrice: string; discount: string }[]
  charges: string[]
  name: string
  /** Address lines, one per row. */
  address: string
  gstin: string
  placeOfSupply: string
  reason: string
}

const rupees = (paise: number) => (paise / 100).toFixed(2)

/** Paise from what was typed, or null when it is not a non-negative amount. */
export function paiseOf(value: string): number | null {
  const text = value.trim()
  if (!/^\d+(\.\d{0,2})?$/.test(text)) return null
  return Math.round(Number(text) * 100)
}

/** Whole quantity from what was typed, or null. */
export function quantityOf(value: string): number | null {
  const text = value.trim()
  return /^\d{1,6}$/.test(text) ? Number(text) : null
}

export function formOf(edit: InvoiceEdit): EditForm {
  return {
    lines: edit.lines.map((l) => ({
      quantity: String(l.quantity),
      unitPrice: rupees(l.unitPricePaise),
      discount: rupees(l.discountPaise),
    })),
    charges: edit.charges.map((c) => rupees(c.amountPaise)),
    name: edit.buyer.name,
    address: edit.buyer.address.join('\n'),
    gstin: edit.buyer.gstin ?? '',
    placeOfSupply: edit.buyer.placeOfSupply,
    reason: '',
  }
}

/** The form as the API takes it, or null while an amount is not a number. */
export function editOf(form: EditForm): InvoiceEdit | null {
  const lines = form.lines.map((l) => ({
    quantity: quantityOf(l.quantity),
    unitPricePaise: paiseOf(l.unitPrice),
    discountPaise: paiseOf(l.discount),
  }))
  const charges = form.charges.map((c) => paiseOf(c))
  if (
    lines.some((l) => l.quantity === null || l.unitPricePaise === null || l.discountPaise === null)
  )
    return null
  if (charges.some((c) => c === null)) return null
  return {
    lines: lines.map((l) => ({
      quantity: l.quantity ?? 0,
      unitPricePaise: l.unitPricePaise ?? 0,
      discountPaise: l.discountPaise ?? 0,
    })),
    charges: charges.map((c) => ({ amountPaise: c ?? 0 })),
    buyer: {
      name: form.name.trim(),
      address: form.address
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean),
      gstin: form.gstin.trim().toUpperCase() || null,
      placeOfSupply: form.placeOfSupply,
    },
  }
}

/** A rough new total for the sheet's footer (the server works out the exact one). */
export function totalOf(edit: InvoiceEdit): number {
  const goods = edit.lines.reduce(
    (a, l) => a + Math.max(0, l.quantity * l.unitPricePaise - l.discountPaise),
    0,
  )
  return goods + edit.charges.reduce((a, c) => a + c.amountPaise, 0)
}

/** GSTR-1 for a month is due on the 11th of the next month (monthly filers). */
const DUE_DAY = 11

/**
 * The filing reminder from the 1st to the 11th: last month's return month and its due day,
 * or null for the rest of the month.
 */
export function filingReminder(now = new Date()): { period: string; due: Date } | null {
  const ist = new Date(now.getTime() + IST_OFFSET_MS)
  if (ist.getUTCDate() > DUE_DAY) return null
  const last = new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth() - 1, 1))
  const period = `${last.getUTCFullYear()}-${String(last.getUTCMonth() + 1).padStart(2, '0')}`
  return { period, due: new Date(monthRange(period).to.getTime() + (DUE_DAY - 1) * 86_400_000) }
}
