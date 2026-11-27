import { describe, expect, it } from 'vitest'
import {
  type BuildDocumentInput,
  buildDocument,
  editableOf,
  editChanges,
  type Party,
  placeOf,
  rebuildDocument,
} from '../src'

const seller: Party = {
  name: 'Wmr Retail Private Limited',
  gstin: '06AAPFU0939F1ZX',
  address: ['14 Sector 29', 'Gurugram, Haryana, 122001'],
  state: placeOf('HR'),
  email: null,
  phone: null,
}

/** Two shirts at 18% and socks at 12%, ₹100 shipping, no discount, delivered to `state`. */
function input(
  over: { shirts?: number; shirtPaise?: number; shipping?: number; state?: string } = {},
): BuildDocumentInput {
  const state = over.state ?? 'MH'
  const shirts = over.shirts ?? 2
  const shirtPaise = over.shirtPaise ?? 100_000
  const shipping = over.shipping ?? 10_000
  return {
    kind: 'tax_invoice',
    number: 'INV/25-26/0001',
    issuedAt: new Date('2025-06-01T10:00:00Z'),
    order: {
      id: 'o1',
      number: 1001,
      placedAt: new Date('2025-06-01T09:00:00Z'),
      paymentMethod: 'razorpay',
      collectPaise: 0,
      shippingPaise: shipping,
      discountPaise: 0,
      paymentAdjustmentPaise: 0,
      paymentAdjustmentLabel: null,
      totalPaise: shirts * shirtPaise + 100_000 + shipping,
      taxBreakdown: null,
    },
    lines: [
      {
        title: 'Shirt',
        variantTitle: 'M',
        sku: 'S-M',
        quantity: shirts,
        unitPricePaise: shirtPaise,
        hsn: '620520',
        ratePercent: 18,
        orderLineId: 'l1',
      },
      {
        title: 'Socks',
        variantTitle: null,
        sku: null,
        quantity: 1,
        unitPricePaise: 100_000,
        hsn: '6115',
        ratePercent: 12,
        orderLineId: 'l2',
      },
    ],
    seller,
    buyer: {
      name: 'Aarav',
      gstin: null,
      address: ['Carter Road', 'Mumbai'],
      state: placeOf(state),
      email: null,
      phone: null,
    },
    shipTo: null,
    placeOfSupply: placeOf(state),
    defaultHsn: '6115',
    hsnDigits: 4,
    fallbackRatePercent: 18,
  }
}

const rebuilt = (r: ReturnType<typeof rebuildDocument>) => {
  if (!r.ok) throw new Error(r.reason)
  return r.doc
}

describe('rebuildDocument', () => {
  it('saving the form unchanged rebuilds the same invoice', () => {
    const doc = buildDocument(input())
    expect(rebuilt(rebuildDocument(doc, editableOf(doc)))).toEqual(doc)
  })

  it('an edit matches issuing the same values fresh', () => {
    const issued = buildDocument(input())
    const form = editableOf(issued)
    form.lines[0] = { quantity: 3, unitPricePaise: 90_000, discountPaise: 0 }
    form.charges[0] = { amountPaise: 5_000 }
    const edited = rebuilt(rebuildDocument(issued, form))
    const fresh = buildDocument(input({ shirts: 3, shirtPaise: 90_000, shipping: 5_000 }))
    expect(edited.lines).toEqual(fresh.lines)
    expect(edited.totals).toEqual(fresh.totals)
    expect(edited.taxSummary).toEqual(fresh.taxSummary)
    expect(edited.hsnSummary).toEqual(fresh.hsnSummary)
    expect(edited.amountInWords).toBe(fresh.amountInWords)
    expect(edited.number).toBe(issued.number)
    expect(edited.issuedAt).toBe(issued.issuedAt)
  })

  it('a new place of supply in the seller state switches IGST to CGST and SGST', () => {
    const issued = buildDocument(input())
    expect(issued.interState).toBe(true)
    const form = editableOf(issued)
    form.buyer.placeOfSupply = 'HR'
    const edited = rebuilt(rebuildDocument(issued, form))
    const fresh = buildDocument(input({ state: 'HR' }))
    expect(edited.interState).toBe(false)
    expect(edited.totals).toEqual(fresh.totals)
    expect(edited.placeOfSupply?.code).toBe('HR')
    expect(edited.buyer.state?.code).toBe('HR')
  })

  it('keeps a line discount on its own line and retaxes it', () => {
    const issued = buildDocument(input())
    const form = editableOf(issued)
    form.lines[1] = { quantity: 1, unitPricePaise: 100_000, discountPaise: 10_000 }
    const edited = rebuilt(rebuildDocument(issued, form))
    const socks = edited.lines.find((l) => l.description === 'Socks')
    expect(socks?.discountPaise).toBe(10_000)
    expect(socks?.totalPaise).toBe(90_000)
    // 12% inside ₹900: ₹96.43.
    expect(socks?.igstPaise).toBe(9_643)
    expect(edited.totals.totalPaise).toBe(issued.totals.totalPaise - 10_000)
  })

  it('drops a line at quantity 0 and a charge at 0, refuses an empty invoice', () => {
    const issued = buildDocument(input())
    const form = editableOf(issued)
    form.lines[1] = { quantity: 0, unitPricePaise: 100_000, discountPaise: 0 }
    form.charges[0] = { amountPaise: 0 }
    const edited = rebuilt(rebuildDocument(issued, form))
    expect(edited.lines.map((l) => l.description)).toEqual(['Shirt / M'])
    const none = editableOf(issued)
    none.lines = none.lines.map((l) => ({ ...l, quantity: 0 }))
    expect(rebuildDocument(issued, none)).toEqual({ ok: false, reason: 'no_goods' })
    const tooMuch = editableOf(issued)
    tooMuch.lines[0] = { quantity: 1, unitPricePaise: 100, discountPaise: 200 }
    expect(rebuildDocument(issued, tooMuch)).toEqual({ ok: false, reason: 'discount' })
    expect(rebuildDocument(issued, { ...form, lines: [] })).toEqual({ ok: false, reason: 'shape' })
  })

  it('lists what changed', () => {
    const issued = buildDocument(input())
    const form = editableOf(issued)
    form.lines[0] = { quantity: 1, unitPricePaise: 100_000, discountPaise: 0 }
    form.buyer.gstin = '27AAPFU0939F1ZV'
    const edited = rebuilt(rebuildDocument(issued, form))
    expect(editChanges(issued, edited)).toEqual([
      'Shirt / M: quantity 2 → 1',
      'Buyer GSTIN: none → 27AAPFU0939F1ZV',
      'Total: ₹3,100.00 → ₹2,100.00',
    ])
    expect(editChanges(issued, rebuilt(rebuildDocument(issued, editableOf(issued))))).toEqual([])
  })
})
