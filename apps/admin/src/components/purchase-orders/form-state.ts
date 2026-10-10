import {
  convertToPaise,
  minorToText,
  type PurchaseCurrency,
  type PurchaseOrderInput,
  parseAmountMinor,
  parseFxRate,
} from '@commerce/core/inventory'
import type { api } from '@/lib/api-client'

export type LoadedPurchaseOrder = NonNullable<Awaited<ReturnType<typeof api.purchaseOrders.get>>>

export type PoLine = {
  variantId: string
  productTitle: string
  variantTitle: string
  sku: string | null
  imageUrl: string | null
  quantity: string
  /** Price per unit as typed, in the order's currency; converted to minor units on save. */
  unitPrice: string
  hsnCode: string
  received: number
  rejected: number
}

/** The editable shape of a purchase order: money and counts stay strings while typed. */
export type PoForm = {
  supplierId: string | null
  supplierName: string
  supplierEmail: string
  supplierPhone: string
  locationId: string
  /** yyyy-mm-dd for the date input, or empty. */
  expectedAt: string
  currency: PurchaseCurrency
  /** Rupees for one unit of the currency, as typed. */
  fxRate: string
  note: string
  lines: PoLine[]
}

export function toCount(text: string): number {
  const n = Number.parseInt(text, 10)
  return Number.isFinite(n) && n > 0 ? n : 0
}

/** "83.250000" from the database as "83.25" for the input. */
export function rateText(rate: string): string {
  return rate.includes('.') ? rate.replace(/0+$/, '').replace(/\.$/, '') : rate
}

export function emptyPoForm(locationId: string): PoForm {
  return {
    supplierId: null,
    supplierName: '',
    supplierEmail: '',
    supplierPhone: '',
    locationId,
    expectedAt: '',
    currency: 'INR',
    fxRate: '1',
    note: '',
    lines: [],
  }
}

export function fromPurchaseOrder(po: LoadedPurchaseOrder): PoForm {
  const currency = po.currency as PurchaseCurrency
  return {
    supplierId: po.supplierId,
    supplierName: po.supplierName,
    supplierEmail: po.supplierEmail ?? '',
    supplierPhone: po.supplierPhone ?? '',
    locationId: po.locationId,
    expectedAt: po.expectedAt ? new Date(po.expectedAt).toISOString().slice(0, 10) : '',
    currency,
    fxRate: rateText(po.fxRate),
    note: po.note ?? '',
    lines: po.lines.map((l) => ({
      variantId: l.variantId,
      productTitle: l.productTitle,
      variantTitle: l.variantTitle,
      sku: l.sku,
      imageUrl: l.imageUrl,
      quantity: String(l.quantity),
      unitPrice: minorToText(l.unitPriceMinor, currency),
      hsnCode: l.hsnCode ?? '',
      received: l.received,
      rejected: l.rejected,
    })),
  }
}

/** The rate the form's money converts at; 1 for INR, null while the typed rate is not valid. */
export function formRate(form: Pick<PoForm, 'currency' | 'fxRate'>): string | null {
  if (form.currency === 'INR') return '1'
  return parseFxRate(form.fxRate) === null ? null : form.fxRate.trim()
}

/** Lines in the shape `purchaseOrderTotals` takes, goods already in paise. */
export function lineNumbers(form: PoForm) {
  const rate = formRate(form)
  return form.lines.map((l) => {
    const quantity = toCount(l.quantity)
    const unitPriceMinor = parseAmountMinor(l.unitPrice, form.currency) ?? 0
    return {
      variantId: l.variantId,
      quantity,
      unitPriceMinor,
      received: l.received,
      rejected: l.rejected,
      goodsPaise: rate ? convertToPaise(quantity * unitPriceMinor, form.currency, rate) : 0,
    }
  })
}

/** Why the form cannot be saved yet, or null. Prices must fit the currency's decimals. */
export function formProblem(form: PoForm): 'rate' | 'price' | null {
  if (formRate(form) === null) return 'rate'
  const bad = form.lines.some(
    (l) => l.unitPrice.trim() !== '' && parseAmountMinor(l.unitPrice, form.currency) === null,
  )
  return bad ? 'price' : null
}

export function toInput(
  form: PoForm,
  id: string | undefined,
  markOrdered = false,
): PurchaseOrderInput {
  return {
    id,
    markOrdered,
    supplierId: form.supplierId,
    supplierName: form.supplierName.trim(),
    supplierEmail: form.supplierEmail.trim(),
    supplierPhone: form.supplierPhone.trim() || undefined,
    locationId: form.locationId,
    expectedAt: form.expectedAt ? new Date(form.expectedAt) : null,
    currency: form.currency,
    fxRate: formRate(form) ?? '1',
    note: form.note.trim() || undefined,
    lines: form.lines
      .map((l) => ({
        variantId: l.variantId,
        quantity: toCount(l.quantity),
        unitPriceMinor: parseAmountMinor(l.unitPrice, form.currency) ?? 0,
        hsnCode: l.hsnCode.trim(),
      }))
      .filter((l) => l.quantity > 0),
  }
}
