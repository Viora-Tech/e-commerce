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
  /** The merchant's own name for the order, or empty. */
  name: string
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
    name: '',
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
    name: po.name ?? '',
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
    name: form.name.trim() || undefined,
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

/** What the Select products dialog hands back, cut down to what a purchase order line needs. */
export type PickedForPo = {
  product: {
    title: string
    imageUrl: string | null
    variants: { id: string; title: string; sku: string | null; costPaise: number | null }[]
  }
  variantIds: string[]
}[]

/**
 * The order's lines plus every variant ticked in Select products, in the dialog's order. A
 * variant already on the order is skipped rather than doubled. A new line starts at quantity
 * 1 and, when buying in rupees, at the variant's current cost; other currencies start blank.
 */
export function addPickedLines(
  lines: PoLine[],
  picked: PickedForPo,
  currency: PurchaseCurrency,
): PoLine[] {
  const have = new Set(lines.map((l) => l.variantId))
  const added: PoLine[] = []
  for (const { product, variantIds } of picked) {
    for (const v of product.variants) {
      if (!variantIds.includes(v.id) || have.has(v.id)) continue
      have.add(v.id)
      added.push({
        variantId: v.id,
        productTitle: product.title,
        variantTitle: v.title,
        sku: v.sku,
        imageUrl: product.imageUrl,
        quantity: '1',
        unitPrice: currency === 'INR' && v.costPaise ? minorToText(v.costPaise, 'INR') : '',
        hsnCode: '',
        received: 0,
        rejected: 0,
      })
    }
  }
  return [...lines, ...added]
}
