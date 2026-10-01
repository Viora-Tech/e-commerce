import type { PurchaseOrderInput } from '@commerce/core/inventory'
import { parseRupees } from '@commerce/money'
import type { api } from '@/lib/api-client'

export type LoadedPurchaseOrder = NonNullable<Awaited<ReturnType<typeof api.purchaseOrders.get>>>

export type PoLine = {
  variantId: string
  productTitle: string
  variantTitle: string
  sku: string | null
  imageUrl: string | null
  quantity: string
  /** Rupees as typed; converted to paise on save. */
  unitCost: string
  received: number
}

/** The editable shape of a purchase order: money and counts stay strings while typed. */
export type PoForm = {
  supplierName: string
  supplierEmail: string
  supplierPhone: string
  locationId: string
  /** yyyy-mm-dd for the date input, or empty. */
  expectedAt: string
  shipping: string
  tax: string
  note: string
  lines: PoLine[]
}

const rupees = (paise: number) => (paise === 0 ? '' : String(paise / 100))

export function toCount(text: string): number {
  const n = Number.parseInt(text, 10)
  return Number.isFinite(n) && n > 0 ? n : 0
}

export function emptyPoForm(locationId: string): PoForm {
  return {
    supplierName: '',
    supplierEmail: '',
    supplierPhone: '',
    locationId,
    expectedAt: '',
    shipping: '',
    tax: '',
    note: '',
    lines: [],
  }
}

export function fromPurchaseOrder(po: LoadedPurchaseOrder): PoForm {
  return {
    supplierName: po.supplierName,
    supplierEmail: po.supplierEmail ?? '',
    supplierPhone: po.supplierPhone ?? '',
    locationId: po.locationId,
    expectedAt: po.expectedAt ? new Date(po.expectedAt).toISOString().slice(0, 10) : '',
    shipping: rupees(po.shippingPaise),
    tax: rupees(po.taxPaise),
    note: po.note ?? '',
    lines: po.lines.map((l) => ({
      variantId: l.variantId,
      productTitle: l.productTitle,
      variantTitle: l.variantTitle,
      sku: l.sku,
      imageUrl: l.imageUrl,
      quantity: String(l.quantity),
      unitCost: rupees(l.unitCostPaise),
      received: l.received,
    })),
  }
}

/** Lines in the shape `purchaseOrderTotals` and the API take. */
export function lineNumbers(form: PoForm) {
  return form.lines.map((l) => ({
    variantId: l.variantId,
    quantity: toCount(l.quantity),
    unitCostPaise: parseRupees(l.unitCost) ?? 0,
    received: l.received,
  }))
}

export function toInput(form: PoForm, id: string | undefined): PurchaseOrderInput {
  return {
    id,
    supplierName: form.supplierName.trim(),
    supplierEmail: form.supplierEmail.trim(),
    supplierPhone: form.supplierPhone.trim() || undefined,
    locationId: form.locationId,
    expectedAt: form.expectedAt ? new Date(form.expectedAt) : null,
    shippingPaise: parseRupees(form.shipping) ?? 0,
    taxPaise: parseRupees(form.tax) ?? 0,
    note: form.note.trim() || undefined,
    lines: lineNumbers(form)
      .filter((l) => l.quantity > 0)
      .map(({ received: _r, ...l }) => l),
  }
}
