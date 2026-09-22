import { computeOrderGst } from '@commerce/core/gst'
import { describe, expect, it } from 'vitest'
import {
  type BuildDocumentInput,
  buildCreditNote,
  buildDocument,
  defaultInvoiceSettings,
  type Party,
  placeOf,
  type SourceLine,
  sampleDocument,
} from '../src'

const seller: Party = {
  name: 'Wmr Retail Private Limited',
  gstin: '06AAPFU0939F1ZX',
  address: ['14 Sector 29', 'Gurugram, Haryana, 122001'],
  state: placeOf('HR'),
  email: null,
  phone: null,
}
const buyer = (state: string): Party => ({
  name: 'Aarav',
  gstin: null,
  address: [],
  state: placeOf(state),
  email: null,
  phone: null,
})

function input(over: Partial<BuildDocumentInput> & { state?: string } = {}): BuildDocumentInput {
  const state = over.state ?? 'MH'
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
      shippingPaise: 10_000,
      discountPaise: 30_000,
      paymentAdjustmentPaise: 0,
      paymentAdjustmentLabel: null,
      totalPaise: 280_000,
      taxBreakdown: null,
    },
    lines: [
      {
        title: 'Shirt',
        variantTitle: 'M',
        sku: 'S-M',
        quantity: 2,
        unitPricePaise: 100_000,
        hsn: '620520',
        ratePercent: 18,
      },
      {
        title: 'Socks',
        variantTitle: 'Default',
        sku: null,
        quantity: 1,
        unitPricePaise: 100_000,
        hsn: null,
        ratePercent: 12,
      },
    ],
    seller,
    buyer: buyer(state),
    shipTo: null,
    placeOfSupply: placeOf(state),
    defaultHsn: '6115',
    hsnDigits: 4,
    fallbackRatePercent: 18,
    ...over,
  }
}

describe('buildDocument', () => {
  it('matches the GST recorded at checkout to the paisa', () => {
    const recorded = computeOrderGst({
      lines: [
        { grossPaise: 200_000, ratePercent: 18 },
        { grossPaise: 100_000, ratePercent: 12 },
      ],
      totalPaise: 280_000,
      reductionPaise: 30_000,
      shipToState: 'MH',
      storeState: 'HR',
    })
    const base = input()
    const doc = buildDocument({ ...base, order: { ...base.order, taxBreakdown: recorded } })
    expect(doc.totals.totalPaise).toBe(280_000)
    expect(doc.totals.taxPaise).toBe(recorded.taxPaise)
    expect(doc.totals.igstPaise).toBe(recorded.igstPaise)
    expect(doc.taxSummary.map((r) => [r.ratePercent, r.taxablePaise + r.igstPaise])).toEqual(
      recorded.byRate.map((r) => [r.ratePercent, r.amountPaise]),
    )
    expect(doc.interState).toBe(true)
    expect(doc.lines.every((l) => l.cgstPaise === 0 && l.sgstPaise === 0)).toBe(true)
  })

  it('spreads the discount by value and puts shipping on the principal rate', () => {
    const doc = buildDocument(input())
    const [shirt, socks, shipping] = doc.lines
    expect(shirt?.discountPaise).toBe(20_000)
    expect(socks?.discountPaise).toBe(10_000)
    expect(shipping).toMatchObject({
      description: 'Shipping charges',
      ratePercent: 18,
      hsn: '6205',
      charge: true,
    })
    expect(socks?.hsn).toBe('6115')
    expect(socks?.description).toBe('Socks')
    for (const l of doc.lines) {
      expect(l.taxablePaise + l.cgstPaise + l.sgstPaise + l.igstPaise).toBe(l.totalPaise)
    }
  })

  it('splits intra-state tax into CGST and SGST with the odd paisa on CGST', () => {
    const doc = buildDocument(input({ state: 'HR' }))
    expect(doc.interState).toBe(false)
    expect(doc.totals.igstPaise).toBe(0)
    for (const row of doc.taxSummary) {
      expect(row.cgstPaise - row.sgstPaise).toBeGreaterThanOrEqual(0)
      expect(row.cgstPaise - row.sgstPaise).toBeLessThanOrEqual(1)
    }
    expect(doc.totals.cgstPaise + doc.totals.sgstPaise).toBe(doc.totals.taxPaise)
  })

  it('treats an unknown place of supply as inter-state', () => {
    const doc = buildDocument(input({ placeOfSupply: null, buyer: buyer('XX') }))
    expect(doc.interState).toBe(true)
  })

  it('says the total in words with lakh and crore', () => {
    const base = input()
    const doc = buildDocument({
      ...base,
      order: { ...base.order, shippingPaise: 0, discountPaise: 0, totalPaise: 1_23_45_678_90 },
      lines: [{ ...(base.lines[0] as SourceLine), quantity: 1, unitPricePaise: 1_23_45_678_90 }],
    })
    expect(doc.amountInWords).toBe(
      'Rupees One Crore Twenty Three Lakh Forty Five Thousand Six Hundred Seventy Eight and Ninety Paise Only',
    )
  })

  it('never lets a shopper-visible total drift, whatever the mix', () => {
    for (let n = 1; n < 40; n++) {
      const base = input()
      const total = 250_000 + n * 1_337
      const doc = buildDocument({
        ...base,
        order: {
          ...base.order,
          discountPaise: n * 17,
          shippingPaise: total - 300_000 + n * 17,
          totalPaise: total,
        },
      })
      expect(doc.totals.totalPaise).toBe(total)
    }
  })
})

describe('buildCreditNote', () => {
  const invoice = buildDocument(input({ state: 'HR' }))

  it('reverses the invoice line for line on a full refund', () => {
    const note = buildCreditNote({
      invoice,
      number: 'CN/25-26/0001',
      issuedAt: new Date('2025-06-10T10:00:00Z'),
      amountPaise: invoice.totals.totalPaise,
      reason: 'Returned',
    })
    expect(note.kind).toBe('credit_note')
    expect(note.original).toEqual({ number: 'INV/25-26/0001', issuedAt: invoice.issuedAt })
    expect(note.totals).toEqual(invoice.totals)
  })

  it('reverses the tax inside a partial refund at each line rate', () => {
    const note = buildCreditNote({
      invoice,
      number: 'CN/25-26/0002',
      issuedAt: new Date('2025-06-10T10:00:00Z'),
      amountPaise: 50_000,
      reason: null,
    })
    expect(note.totals.totalPaise).toBe(50_000)
    expect(note.totals.igstPaise).toBe(0)
    for (const row of note.taxSummary) {
      const gross = row.taxablePaise + row.cgstPaise + row.sgstPaise
      expect(row.cgstPaise + row.sgstPaise).toBe(
        Math.round((gross * row.ratePercent) / (100 + row.ratePercent)),
      )
    }
  })
})

describe('sampleDocument', () => {
  it('builds every kind from default settings', () => {
    for (const kind of [
      'tax_invoice',
      'credit_note',
      'packing_slip',
      'order_confirmation',
    ] as const) {
      const doc = sampleDocument(
        defaultInvoiceSettings,
        kind,
        'Wmr',
        new Date('2025-06-01T00:00:00Z'),
      )
      expect(doc.kind).toBe(kind)
      expect(doc.totals.totalPaise).toBe(kind === 'credit_note' ? 1_18_200 : 3_67_900)
    }
  })
})
