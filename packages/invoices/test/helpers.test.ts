import { describe, expect, it } from 'vitest'
import {
  amountInWords,
  B2CL_THRESHOLD_PAISE,
  buildDocument,
  buildGstr1,
  checkDocumentNumber,
  code128Values,
  code128Widths,
  defaultInvoiceSettings,
  EXPORT_ENDORSEMENTS,
  financialYear,
  formatDocumentNumber,
  formatRupees,
  formatSeriesNumber,
  gstr1Bucket,
  gstr1CreditNote,
  gstr1Invoice,
  InvoiceSettingsSchema,
  indianNumberInWords,
  isEligible,
  parseInvoiceSettings,
  pickSeries,
  placeOf,
  type Series,
  sampleDocument,
} from '../src'
import { buildCreditNote } from '../src/document'
import { documentLinkPath, signDocumentLink, verifyDocumentLink } from '../src/link'

describe('words', () => {
  it('uses the Indian system', () => {
    expect(indianNumberInWords(0)).toBe('Zero')
    expect(indianNumberInWords(1_00_000)).toBe('One Lakh')
    expect(indianNumberInWords(12_34_56_789)).toBe(
      'Twelve Crore Thirty Four Lakh Fifty Six Thousand Seven Hundred Eighty Nine',
    )
    expect(indianNumberInWords(1_00_00_00_000)).toBe('One Hundred Crore')
  })

  it('reads rupees and paise', () => {
    expect(amountInWords(1_23_456_78)).toBe(
      'Rupees One Lakh Twenty Three Thousand Four Hundred Fifty Six and Seventy Eight Paise Only',
    )
    expect(amountInWords(50_000)).toBe('Rupees Five Hundred Only')
    expect(amountInWords(5)).toBe('Rupees Zero and Five Paise Only')
  })

  it('formats rupees with Indian grouping', () => {
    expect(formatRupees(1_23_456_78)).toBe('₹1,23,456.78')
  })
})

describe('numbering', () => {
  it('rolls the financial year over at midnight IST on 1 April', () => {
    // 31 March 23:59 IST is 18:29 UTC; 1 April 00:00 IST is 18:30 UTC.
    expect(financialYear(new Date('2026-03-31T18:29:59Z')).label).toBe('25-26')
    expect(financialYear(new Date('2026-03-31T18:30:00Z')).label).toBe('26-27')
    expect(financialYear(new Date('2026-01-15T00:00:00Z')).startYear).toBe(2025)
  })

  it('formats numbers within the rule 46(b) limits', () => {
    const fy = financialYear(new Date('2025-06-01T00:00:00Z'))
    const n = formatDocumentNumber({ prefix: 'INV', fy, seq: 7, pad: 4, includeFy: true })
    expect(n).toBe('INV/25-26/0007')
    expect(checkDocumentNumber(n)).toEqual({ ok: true })
    expect(checkDocumentNumber('INVOICE/2025-26/00001')).toEqual({ ok: false, reason: 'length' })
    expect(checkDocumentNumber('INV#1')).toEqual({ ok: false, reason: 'characters' })
  })
})

describe('settings', () => {
  it('parses an empty blob to defaults and survives junk', () => {
    expect(parseInvoiceSettings(null)).toEqual(defaultInvoiceSettings)
    expect(parseInvoiceSettings({ template: 'nope' })).toEqual(defaultInvoiceSettings)
    expect(defaultInvoiceSettings.documents.tax_invoice.fields.hsn).toBe(true)
  })

  it('refuses a series whose numbers would overflow sixteen characters', () => {
    const series = [...defaultInvoiceSettings.series]
    series[0] = { ...(series[0] as Series), pattern: 'INVOICE/{FY}/', pad: 5 }
    const r = InvoiceSettingsSchema.safeParse({ series })
    expect(r.success).toBe(false)
  })

  it('needs a domestic and an export series for every numbered kind', () => {
    const r = InvoiceSettingsSchema.safeParse({
      series: defaultInvoiceSettings.series.filter((x) => x.id !== 'exp'),
    })
    expect(r.success).toBe(false)
  })

  it('picks the series by kind and rule, B2B before domestic when listed first', () => {
    const series = [
      {
        id: 'b2b',
        name: 'B2B',
        kind: 'tax_invoice' as const,
        rule: 'b2b' as const,
        pattern: 'B2B/{FY}/',
        pad: 4,
      },
      ...defaultInvoiceSettings.series,
    ]
    expect(pickSeries(series, 'tax_invoice', { export: false, b2b: true })?.id).toBe('b2b')
    expect(pickSeries(series, 'tax_invoice', { export: false, b2b: false })?.id).toBe('inv')
    expect(pickSeries(series, 'tax_invoice', { export: true, b2b: true })?.id).toBe('exp')
    expect(pickSeries(series, 'credit_note', { export: true, b2b: false })?.id).toBe('ecn')
    const fy = financialYear(new Date('2026-04-01T00:00:00Z'))
    expect(formatSeriesNumber(series[2] as Series, fy, 7)).toBe('EXP/26-27/0007')
  })

  it('validates the seller GSTIN checksum', () => {
    const bad = InvoiceSettingsSchema.safeParse({ seller: { gstin: '27AAPFU0939F1ZW' } })
    expect(bad.success).toBe(false)
    const good = InvoiceSettingsSchema.safeParse({ seller: { gstin: '27aapfu0939f1zv' } })
    expect(good.success && good.data.seller.gstin).toBe('27AAPFU0939F1ZV')
  })

  it('queues on the configured event, and pre-orders only at dispatch', () => {
    expect(isEligible(defaultInvoiceSettings, 'paid', false)).toBe(true)
    expect(isEligible(defaultInvoiceSettings, 'paid', true)).toBe(false)
    expect(isEligible(defaultInvoiceSettings, 'fulfilled', true)).toBe(true)
    const onShip = parseInvoiceSettings({ issueOn: 'fulfilment' })
    expect(isEligible(onShip, 'paid', false)).toBe(false)
    expect(isEligible(parseInvoiceSettings({ issueOn: 'manual' }), 'fulfilled', false)).toBe(false)
  })
})

describe('GSTR-1', () => {
  const now = new Date('2025-06-01T00:00:00Z')
  const b2b = sampleDocument(defaultInvoiceSettings, 'tax_invoice', 'Wmr', now)
  const small = { ...b2b, number: 'INV/25-26/0043', buyer: { ...b2b.buyer, gstin: null } }

  it('buckets by registration, state and the ₹1 lakh B2CL threshold', () => {
    expect(gstr1Bucket({ buyerGstin: 'X', interState: true, totalPaise: 1 })).toBe('b2b')
    expect(
      gstr1Bucket({ buyerGstin: null, interState: true, totalPaise: B2CL_THRESHOLD_PAISE + 1 }),
    ).toBe('b2cl')
    expect(
      gstr1Bucket({ buyerGstin: null, interState: true, totalPaise: B2CL_THRESHOLD_PAISE }),
    ).toBe('b2cs')
    expect(gstr1Bucket({ buyerGstin: null, interState: false, totalPaise: 10 ** 9 })).toBe('b2cs')
  })

  it('lays out each table like the offline tool', () => {
    const note = buildCreditNote({
      invoice: b2b,
      number: 'CN/25-26/0001',
      issuedAt: now,
      amountPaise: 10_000,
      reason: null,
    })
    const out = buildGstr1([gstr1Invoice(b2b), gstr1Invoice(small)], [gstr1CreditNote(note, b2b)])
    const b2bRows = out.b2b.split('\n')
    expect(b2bRows[0]).toBe(
      'GSTIN/UIN of Recipient,Receiver Name,Invoice Number,Invoice date,Invoice Value,Place Of Supply,Reverse Charge,Applicable % of Tax Rate,Invoice Type,E-Commerce GSTIN,Rate,Taxable Value,Cess Amount',
    )
    // One row per rate on the invoice.
    expect(b2bRows).toHaveLength(1 + b2b.taxSummary.length)
    expect(b2bRows[1]).toContain(
      '27AAPFU0939F1ZV,Aarav Mehta,INV/25-26/0042,01-Jun-2025,3679.00,27-Maharashtra,N,,Regular B2B,,12,',
    )
    // ₹3,679 inter-state to an unregistered buyer is under ₹1 lakh: B2C small.
    expect(out.b2cl.split('\n')).toHaveLength(1)
    expect(out.b2cs.split('\n').slice(1)).toEqual(
      small.taxSummary.map(
        (r) => `OE,27-Maharashtra,,${r.ratePercent},${(r.taxablePaise / 100).toFixed(2)},0.00,`,
      ),
    )
    expect(out.cdnr.split('\n')).toHaveLength(1 + note.taxSummary.length)
    expect(out.cdnr.split('\n')[1]).toMatch(
      /^27AAPFU0939F1ZV,Aarav Mehta,CN\/25-26\/0001,01-Jun-2025,C,27-Maharashtra,N,Regular B2B,100.00,,/,
    )
    expect(out.cdnur.split('\n')).toHaveLength(1)
    const hsnHeader = out.hsn.split('\n')[0]
    expect(hsnHeader).toBe(
      'HSN,Description,UQC,Total Quantity,Total Value,Rate,Taxable Value,Integrated Tax Amount,Central Tax Amount,State/UT Tax Amount,Cess Amount',
    )
  })

  it('nets the HSN summary after credit notes', () => {
    const note = buildCreditNote({
      invoice: b2b,
      number: 'CN1',
      issuedAt: now,
      amountPaise: b2b.totals.totalPaise,
      reason: null,
    })
    const out = buildGstr1([gstr1Invoice(b2b)], [gstr1CreditNote(note, b2b)])
    for (const row of out.hsn.split('\n').slice(1)) {
      expect(row).toMatch(/,0,0\.00,\d+,0\.00,0\.00,0\.00,0\.00,0\.00$/)
    }
  })

  it('puts a large inter-state B2C invoice in B2CL', () => {
    const doc = buildDocument({
      kind: 'tax_invoice',
      number: 'INV/25-26/0100',
      issuedAt: now,
      order: {
        id: 'o',
        number: 1,
        placedAt: now,
        paymentMethod: null,
        collectPaise: 0,
        shippingPaise: 0,
        discountPaise: 0,
        paymentAdjustmentPaise: 0,
        paymentAdjustmentLabel: null,
        totalPaise: 2_00_000_00,
        taxBreakdown: null,
      },
      lines: [
        {
          title: 'Sofa',
          variantTitle: null,
          sku: null,
          quantity: 1,
          unitPricePaise: 2_00_000_00,
          hsn: '9401',
          ratePercent: 18,
        },
      ],
      seller: b2b.seller,
      buyer: { ...b2b.buyer, gstin: null },
      shipTo: null,
      placeOfSupply: placeOf('KA'),
      defaultHsn: '',
      hsnDigits: 4,
      fallbackRatePercent: 18,
    })
    const out = buildGstr1([gstr1Invoice(doc)], [])
    expect(out.b2cl.split('\n')[1]).toBe(
      'INV/25-26/0100,01-Jun-2025,200000.00,29-Karnataka,,18,169491.53,0.00,',
    )
  })
})

const NL = String.fromCharCode(10)

describe('GSTR-1 Table 13', () => {
  it('counts issued and cancelled per series, never reusing numbers', () => {
    const out = buildGstr1(
      [],
      [],
      [
        { kind: 'tax_invoice', series: 'inv', number: 'INV/26-27/0003', seq: 3, cancelled: false },
        { kind: 'tax_invoice', series: 'inv', number: 'INV/26-27/0001', seq: 1, cancelled: false },
        { kind: 'tax_invoice', series: 'inv', number: 'INV/26-27/0002', seq: 2, cancelled: true },
        { kind: 'tax_invoice', series: 'exp', number: 'EXP/26-27/0001', seq: 1, cancelled: false },
        { kind: 'credit_note', series: 'cn', number: 'CN/26-27/0001', seq: 1, cancelled: false },
      ],
    )
    expect(out.docs.split(NL)).toEqual([
      'Nature of Document,Sr. No. From,Sr. No. To,Total Number,Cancelled,Net Issued',
      'Invoices for outward supply,EXP/26-27/0001,EXP/26-27/0001,1,0,1',
      'Invoices for outward supply,INV/26-27/0001,INV/26-27/0003,3,1,2',
      'Credit Note,CN/26-27/0001,CN/26-27/0001,1,0,1',
    ])
  })
})

describe('exports', () => {
  const now = new Date('2026-09-10T06:00:00Z')
  const base = sampleDocument(defaultInvoiceSettings, 'tax_invoice', 'Wmr', now)
  const exportDoc = (mode: 'lut' | 'igst') =>
    buildDocument({
      kind: 'tax_invoice',
      number: 'EXP/26-27/0001',
      issuedAt: now,
      order: {
        id: 'o',
        number: 7,
        placedAt: now,
        paymentMethod: null,
        collectPaise: 0,
        shippingPaise: 0,
        discountPaise: 0,
        paymentAdjustmentPaise: 0,
        paymentAdjustmentLabel: null,
        totalPaise: 1_18_000,
        taxBreakdown: null,
      },
      lines: [
        {
          title: 'Kurta',
          variantTitle: null,
          sku: null,
          quantity: 1,
          unitPricePaise: 1_18_000,
          hsn: '6205',
          ratePercent: 18,
        },
      ],
      seller: base.seller,
      buyer: { ...base.buyer, gstin: null, state: null },
      shipTo: null,
      placeOfSupply: null,
      defaultHsn: '',
      hsnDigits: 4,
      fallbackRatePercent: 18,
      exportSupply: {
        mode,
        country: 'AE',
        countryName: 'United Arab Emirates',
        lutNumber: mode === 'lut' ? 'AD0604260012345' : null,
        endorsement: EXPORT_ENDORSEMENTS[mode],
        portCode: 'INBOM4',
        shippingBillNumber: '1234567',
        shippingBillDate: '2026-09-11',
        currency: 'USD',
        exchangeRate: 83.5,
      },
    })

  it('under LUT charges no IGST and carries the endorsement and place of supply 96', () => {
    const doc = exportDoc('lut')
    expect(doc.totals).toMatchObject({ taxPaise: 0, taxablePaise: 1_18_000, totalPaise: 1_18_000 })
    expect(doc.placeOfSupply).toEqual({ code: 'OT', gstCode: '96', name: 'Outside India' })
    expect(doc.exportSupply?.endorsement).toBe(
      'SUPPLY MEANT FOR EXPORT UNDER LETTER OF UNDERTAKING WITHOUT PAYMENT OF INTEGRATED TAX',
    )
  })

  it('with payment of IGST extracts IGST; both go to Table 6A, not B2C', () => {
    const paid = exportDoc('igst')
    expect(paid.totals.igstPaise).toBe(18_000)
    const out = buildGstr1(
      [gstr1Invoice(exportDoc('lut')), gstr1Invoice({ ...paid, number: 'EXP/26-27/0002' })],
      [],
    )
    expect(out.exp.split(NL).slice(1)).toEqual([
      'WOPAY,EXP/26-27/0001,10-Sep-2026,1180.00,INBOM4,1234567,11-Sep-2026,0,1180.00,0.00',
      'WPAY,EXP/26-27/0002,10-Sep-2026,1180.00,INBOM4,1234567,11-Sep-2026,18,1000.00,0.00',
    ])
    expect(out.b2cs.split(NL)).toHaveLength(1)
    expect(out.b2cl.split(NL)).toHaveLength(1)
  })
})

describe('Code 128', () => {
  it('encodes with a correct check symbol', () => {
    // 104 + 48·1 + 42·2 + 42·3 + 17·4 + 18·5 + 19·6 + 35·7 = 879; 879 mod 103 = 55.
    expect(code128Values('PJJ123C')).toEqual([104, 48, 42, 42, 17, 18, 19, 35, 55])
  })

  it('switches to subset C for long digit runs', () => {
    const v = code128Values('INV1234567890')
    expect(v[0]).toBe(104)
    expect(v).toContain(99)
    // Every symbol is 11 modules; stop is 13.
    const widths = code128Widths('INV1234567890')
    expect(widths.reduce((a, b) => a + b, 0)).toBe(v.length * 11 + 13)
  })

  it('refuses characters outside subset B', () => {
    expect(() => code128Values('₹10')).toThrow()
  })
})

describe('download links', () => {
  const input = { storeId: 's1', documentId: 'd1' }
  const now = new Date('2025-06-01T00:00:00Z')

  it('verifies its own signature until it expires', () => {
    const { expires, token } = signDocumentLink('secret', input, now, 60)
    expect(verifyDocumentLink('secret', { ...input, expires, token }, now)).toBe(true)
    expect(
      verifyDocumentLink('secret', { ...input, expires, token }, new Date(now.getTime() + 61_000)),
    ).toBe(false)
    expect(verifyDocumentLink('other', { ...input, expires, token }, now)).toBe(false)
    expect(verifyDocumentLink('secret', { ...input, documentId: 'd2', expires, token }, now)).toBe(
      false,
    )
    expect(verifyDocumentLink('secret', { ...input, expires: expires + 1, token }, now)).toBe(false)
  })

  it('builds a storefront path', () => {
    expect(documentLinkPath('secret', input, now)).toMatch(/^\/documents\/d1\?e=\d+&t=[\w-]{32}$/)
  })
})
