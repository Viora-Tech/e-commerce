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

describe('buildCreditNote for a return (#872)', () => {
  // A 12% kurta pair, an 18% diya set, shipping (at the principal 12%) and an order discount.
  const lines: SourceLine[] = [
    {
      title: 'Kurta',
      variantTitle: null,
      sku: 'K',
      quantity: 2,
      unitPricePaise: 1_29_900,
      hsn: '62059090',
      ratePercent: 12,
      orderLineId: 'line-kurta',
    },
    {
      title: 'Diya set',
      variantTitle: null,
      sku: 'D',
      quantity: 2,
      unitPricePaise: 1_18_200,
      hsn: '74181022',
      ratePercent: 18,
      orderLineId: 'line-diya',
    },
  ]
  const invoice = buildDocument(
    input({
      lines,
      order: {
        ...input().order,
        shippingPaise: 9_900,
        discountPaise: 20_000,
        totalPaise: 2 * 1_29_900 + 2 * 1_18_200 + 9_900 - 20_000,
      },
    }),
  )
  const diya = invoice.lines.find((l) => l.orderLineId === 'line-diya')
  const note = (amountPaise: number, returned = [{ orderLineId: 'line-diya', quantity: 1 }]) =>
    buildCreditNote({
      invoice,
      number: 'CN/25-26/0009',
      issuedAt: new Date('2025-06-10T10:00:00Z'),
      amountPaise,
      reason: 'Returned',
      returned,
    })

  it('records the order line on goods lines, not on charges', () => {
    expect(invoice.lines.map((l) => l.orderLineId ?? null)).toEqual([
      'line-kurta',
      'line-diya',
      null,
    ])
  })

  it('credits only the returned units, at their own rate', () => {
    const one = Math.round((diya?.totalPaise ?? 0) / 2)
    const n = note(one)
    expect(n.lines).toHaveLength(1)
    expect(n.lines[0]).toMatchObject({ orderLineId: 'line-diya', quantity: 1, ratePercent: 18 })
    expect(n.totals.totalPaise).toBe(one)
    expect(n.taxSummary.map((r) => r.ratePercent)).toEqual([18])
    expect(n.totals.igstPaise).toBe(Math.round((one * 18) / 118))
  })

  it('scales the returned units down when a fee is kept back', () => {
    const n = note(50_000)
    expect(n.lines.map((l) => [l.orderLineId, l.quantity])).toEqual([['line-diya', 1]])
    expect(n.totals.totalPaise).toBe(50_000)
  })

  it('spreads what is refunded beyond the returned units over the other lines', () => {
    const one = Math.round((diya?.totalPaise ?? 0) / 2)
    const n = note(one + 5_000)
    const returnedLine = n.lines.find((l) => l.orderLineId === 'line-diya')
    expect(returnedLine?.quantity).toBe(1)
    expect(n.totals.totalPaise).toBe(one + 5_000)
    // The rest is value only.
    expect(
      n.lines.filter((l) => l.orderLineId !== 'line-diya').every((l) => l.quantity === 0),
    ).toBe(true)
  })

  it('stays pro rata for a value-only refund or an invoice without order lines', () => {
    const valueOnly = note(50_000, [])
    expect(valueOnly.lines.length).toBeGreaterThan(1)
    const old = { ...invoice, lines: invoice.lines.map(({ orderLineId: _, ...l }) => l) }
    const fromOld = buildCreditNote({
      invoice: old,
      number: 'CN/25-26/0010',
      issuedAt: new Date('2025-06-10T10:00:00Z'),
      amountPaise: 50_000,
      reason: null,
      returned: [{ orderLineId: 'line-diya', quantity: 1 }],
    })
    expect(fromOld.lines.length).toBeGreaterThan(1)
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
      if (kind === 'credit_note') {
        // Only the returned diya set, at its own rate (#872).
        expect(doc.lines.map((l) => [l.ratePercent, l.quantity])).toEqual([[18, 1]])
      } else {
        expect(doc.totals.totalPaise).toBe(3_67_900)
      }
    }
  })
})
