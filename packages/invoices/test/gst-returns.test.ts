import { describe, expect, it } from 'vitest'
import {
  buildGstr1Json,
  buildGstr3b,
  type DocumentLine,
  type Gstr1CreditNote,
  type Gstr1Document,
  type Gstr1Invoice,
  gstReturnChecks,
  gstr1SummaryCsv,
  gstr1Totals,
  gstr3bCsv,
  hsnNetQuantities,
  type TaxRow,
} from '../src'

/*
 * Hand-worked month, September 2026, for a Maharashtra (27) GSTIN. Every figure below was
 * worked out on paper from these documents, not read back from the builder.
 *
 *   INV-1  B2B intra, 27AAPFU0939F1ZV     18%  taxable 1,000.00  CGST 90 + SGST 90   = 1,180.00
 *   INV-2  B2C inter to KA (29), large    18%  taxable 1,00,000  IGST 18,000         = 1,18,000
 *   INV-3  B2C inter to KA, exactly ₹1 lakh: not over the line, so B2C small
 *                                         18%  taxable 84,745.76 IGST 15,254.24     = 1,00,000
 *   INV-4  B2C intra, two rates            5%  taxable 1,000  CGST 25 + SGST 25
 *                                         18%  taxable   500  CGST 45 + SGST 45     = 1,640.00
 *   INV-5  B2C intra, nil rated (rice)     0%  200.00
 *   INV-6  Export under LUT (WOPAY)       18%  taxable 500, no IGST
 *   INV-7  cancelled (Table 13 only)
 *   CN-1   against INV-1: 18% taxable 100, CGST 9 + SGST 9 = 118, one unit back      → CDNR
 *   CN-2   against INV-4: the whole 18% part (500 + 45 + 45), one unit back         → nets B2CS
 *   CN-3   against INV-2: 18% taxable 10,000, IGST 1,800 = 11,800 (price cut)      → CDNUR B2CL
 */
const GSTIN = '27AAACW1234A1Z5'
const SEPT = new Date('2026-09-05T06:00:00Z')
const MH = { gstCode: '27', name: 'Maharashtra' }
const KA = { gstCode: '29', name: 'Karnataka' }

function tax(rate: number, taxable: number, igst: number, half: number): TaxRow {
  return {
    ratePercent: rate,
    taxablePaise: taxable,
    igstPaise: igst,
    cgstPaise: half,
    sgstPaise: half,
  }
}

function line(hsn: string, quantity: number, row: TaxRow, charge = false): DocumentLine {
  const total = row.taxablePaise + row.igstPaise + row.cgstPaise + row.sgstPaise
  return {
    description: `Item ${hsn}`,
    sku: null,
    hsn,
    quantity,
    unit: 'NOS',
    unitPricePaise: quantity ? Math.round(total / quantity) : total,
    grossPaise: total,
    discountPaise: 0,
    taxablePaise: row.taxablePaise,
    ratePercent: row.ratePercent,
    cgstPaise: row.cgstPaise,
    sgstPaise: row.sgstPaise,
    igstPaise: row.igstPaise,
    totalPaise: total,
    charge,
  }
}

function invoice(
  number: string,
  opts: Partial<Gstr1Invoice> & { rows: TaxRow[]; lines: DocumentLine[] },
): Gstr1Invoice {
  const { rows, lines, ...rest } = opts
  return {
    number,
    issuedAt: SEPT,
    buyerName: 'Buyer',
    buyerGstin: null,
    placeOfSupply: MH,
    interState: false,
    totalPaise: rows.reduce(
      (a, r) => a + r.taxablePaise + r.igstPaise + r.cgstPaise + r.sgstPaise,
      0,
    ),
    taxSummary: rows,
    lines,
    export: null,
    ...rest,
  }
}

function note(number: string, against: Gstr1Invoice, rows: TaxRow[], lines: DocumentLine[]) {
  return {
    number,
    issuedAt: new Date('2026-09-20T06:00:00Z'),
    invoice: against,
    totalPaise: rows.reduce(
      (a, r) => a + r.taxablePaise + r.igstPaise + r.cgstPaise + r.sgstPaise,
      0,
    ),
    taxSummary: rows,
    lines,
  } satisfies Gstr1CreditNote
}

const r1 = tax(18, 1_000_00, 0, 90_00)
const inv1 = invoice('INV-1', {
  buyerGstin: '27AAPFU0939F1ZV',
  buyerName: 'Mehta Traders',
  rows: [r1],
  lines: [line('6109', 2, r1)],
})
const r2 = tax(18, 1_00_000_00, 18_000_00, 0)
const inv2 = invoice('INV-2', {
  placeOfSupply: KA,
  interState: true,
  rows: [r2],
  lines: [line('9401', 1, r2)],
})
const r3 = tax(18, 84_745_76, 15_254_24, 0)
const inv3 = invoice('INV-3', {
  placeOfSupply: KA,
  interState: true,
  rows: [r3],
  lines: [line('9401', 1, r3)],
})
const r4a = tax(5, 1_000_00, 0, 25_00)
const r4b = tax(18, 500_00, 0, 45_00)
const inv4 = invoice('INV-4', {
  rows: [r4a, r4b],
  lines: [line('6109', 3, r4a), line('4202', 1, r4b)],
})
const r5 = tax(0, 200_00, 0, 0)
const inv5 = invoice('INV-5', { rows: [r5], lines: [line('1006', 1, r5)] })
const r6 = tax(18, 500_00, 0, 0)
const inv6 = invoice('INV-6', {
  placeOfSupply: { gstCode: '96', name: 'Other Country' },
  interState: true,
  rows: [r6],
  lines: [line('6109', 1, r6)],
  export: {
    type: 'WOPAY',
    portCode: 'INBOM4',
    shippingBillNumber: '1234567',
    shippingBillDate: '2026-09-20',
  },
})
const c1 = tax(18, 100_00, 0, 9_00)
const cn1 = note('CN-1', inv1, [c1], [line('6109', 1, c1)])
const cn2 = note('CN-2', inv4, [r4b], [line('4202', 1, r4b)])
const c3 = tax(18, 10_000_00, 1_800_00, 0)
const cn3 = note('CN-3', inv2, [c3], [line('9401', 0, c3)])

const documents: Gstr1Document[] = [
  ...['INV-1', 'INV-2', 'INV-3', 'INV-4', 'INV-5', 'INV-6', 'INV-7'].map((number, i) => ({
    kind: 'tax_invoice' as const,
    series: 'default',
    number,
    seq: i + 1,
    cancelled: number === 'INV-7',
  })),
  ...['CN-1', 'CN-2', 'CN-3'].map((number, i) => ({
    kind: 'credit_note' as const,
    series: 'credit',
    number,
    seq: i + 1,
    cancelled: false,
  })),
]

const invoices = [inv1, inv2, inv3, inv4, inv5, inv6]
const notes = [cn1, cn2, cn3]
const json = buildGstr1Json({
  gstin: GSTIN,
  period: '2026-09',
  invoices,
  creditNotes: notes,
  documents,
})

describe('GSTR-1 JSON', () => {
  it('carries the GSTIN and the MMYYYY period', () => {
    expect(json.gstin).toBe(GSTIN)
    expect(json.fp).toBe('092026')
  })

  it('lists B2B invoices by buyer GSTIN with the CGST/SGST split', () => {
    expect(json.b2b).toEqual([
      {
        ctin: '27AAPFU0939F1ZV',
        inv: [
          {
            inum: 'INV-1',
            idt: '05-09-2026',
            val: 1180,
            pos: '27',
            rchrg: 'N',
            inv_typ: 'R',
            itms: [
              { num: 1, itm_det: { rt: 18, txval: 1000, iamt: 0, camt: 90, samt: 90, csamt: 0 } },
            ],
          },
        ],
      },
    ])
  })

  it('puts only inter-state B2C invoices over ₹1 lakh in B2CL', () => {
    expect(json.b2cl).toEqual([
      {
        pos: '29',
        inv: [
          {
            inum: 'INV-2',
            idt: '05-09-2026',
            val: 118000,
            itms: [{ num: 1, itm_det: { rt: 18, txval: 100000, iamt: 18000, csamt: 0 } }],
          },
        ],
      },
    ])
  })

  it('sums B2C small by place and rate, net of their credit notes', () => {
    // 27/18% (INV-4's 500) is cancelled out by CN-2, so the row goes.
    expect(json.b2cs).toEqual([
      {
        sply_ty: 'INTRA',
        pos: '27',
        typ: 'OE',
        rt: 5,
        txval: 1000,
        iamt: 0,
        camt: 25,
        samt: 25,
        csamt: 0,
      },
      {
        sply_ty: 'INTER',
        pos: '29',
        typ: 'OE',
        rt: 18,
        txval: 84745.76,
        iamt: 15254.24,
        camt: 0,
        samt: 0,
        csamt: 0,
      },
    ])
  })

  it('reports exports with the shipping bill', () => {
    expect(json.exp).toEqual([
      {
        exp_typ: 'WOPAY',
        inv: [
          {
            inum: 'INV-6',
            idt: '05-09-2026',
            val: 500,
            sbpcode: 'INBOM4',
            sbnum: 1234567,
            sbdt: '20-09-2026',
            itms: [{ txval: 500, rt: 18, iamt: 0, csamt: 0 }],
          },
        ],
      },
    ])
  })

  it('sends notes against B2B to CDNR and against B2CL to CDNUR', () => {
    expect(json.cdnr).toEqual([
      {
        ctin: '27AAPFU0939F1ZV',
        nt: [
          {
            ntty: 'C',
            nt_num: 'CN-1',
            nt_dt: '20-09-2026',
            val: 118,
            pos: '27',
            rchrg: 'N',
            inv_typ: 'R',
            itms: [
              { num: 1, itm_det: { rt: 18, txval: 100, iamt: 0, camt: 9, samt: 9, csamt: 0 } },
            ],
          },
        ],
      },
    ])
    expect(json.cdnur).toEqual([
      {
        typ: 'B2CL',
        ntty: 'C',
        nt_num: 'CN-3',
        nt_dt: '20-09-2026',
        val: 11800,
        pos: '29',
        itms: [{ num: 1, itm_det: { rt: 18, txval: 10000, iamt: 1800, csamt: 0 } }],
      },
    ])
  })

  it('reports 0% supplies in Table 8 only', () => {
    expect(json.nil).toEqual({
      inv: [{ sply_ty: 'INTRAB2C', nil_amt: 200, expt_amt: 0, ngsup_amt: 0 }],
    })
    expect(JSON.stringify(json.b2cs)).not.toContain('"rt":0')
  })

  it('splits the HSN summary into B2B and B2C, net of credit notes', () => {
    expect(json.hsn.hsn_b2b).toEqual([
      {
        hsn_sc: '6109',
        num: 1,
        desc: 'Item 6109',
        uqc: 'NOS',
        qty: 1,
        rt: 18,
        txval: 900,
        iamt: 0,
        camt: 81,
        samt: 81,
        csamt: 0,
      },
    ])
    // 4202 nets to nothing after CN-2 and is left out; 9401 is INV-2 + INV-3 - CN-3.
    expect(json.hsn.hsn_b2c.map((h) => [h.hsn_sc, h.rt, h.qty, h.txval, h.iamt, h.camt])).toEqual([
      ['1006', 0, 1, 200, 0, 0],
      ['6109', 5, 3, 1000, 0, 25],
      ['6109', 18, 1, 500, 0, 0],
      ['9401', 18, 2, 174745.76, 31454.24, 0],
    ])
    expect(json.hsn.hsn_b2c.map((h) => h.num)).toEqual([1, 2, 3, 4])
    // The portal reads hsn_sc first.
    expect(Object.keys(json.hsn.hsn_b2b[0] ?? {})[0]).toBe('hsn_sc')
  })

  it('gives services HSN no quantity', () => {
    const svc = tax(18, 100_00, 0, 9_00)
    const out = buildGstr1Json({
      gstin: GSTIN,
      period: '2026-09',
      invoices: [invoice('S-1', { rows: [svc], lines: [line('998314', 4, svc)] })],
      creditNotes: [],
      documents: [],
    })
    expect(out.hsn.hsn_b2c[0]).toMatchObject({ hsn_sc: '998314', uqc: 'NA', qty: 0 })
  })

  it('summarises documents issued per type and series, cancelled ones counted', () => {
    expect(json.doc_issue.doc_det).toEqual([
      {
        doc_num: 1,
        docs: [{ num: 1, from: 'INV-1', to: 'INV-7', totnum: 7, cancel: 1, net_issue: 6 }],
      },
      {
        doc_num: 5,
        docs: [{ num: 1, from: 'CN-1', to: 'CN-3', totnum: 3, cancel: 0, net_issue: 3 }],
      },
    ])
  })

  it('leaves empty tables out', () => {
    const out = buildGstr1Json({
      gstin: GSTIN,
      period: '2026-09',
      invoices: [],
      creditNotes: [],
      documents: [],
    })
    expect(Object.keys(out)).toEqual(['gstin', 'fp', 'version', 'hash', 'hsn', 'doc_issue'])
  })
})

describe('GSTR-3B', () => {
  const r = buildGstr3b(json)

  it('works 3.1 out from the GSTR-1', () => {
    // 1,000 + 1,00,000 + 1,000 + 84,745.76 - 100 - 10,000
    expect(r.outwardTaxable).toEqual({
      taxablePaise: 1_76_645_76,
      igstPaise: 31_454_24,
      cgstPaise: 106_00,
      sgstPaise: 106_00,
      cessPaise: 0,
    })
    expect(r.zeroRated).toMatchObject({ taxablePaise: 500_00, igstPaise: 0 })
    expect(r.nilExempt).toMatchObject({ taxablePaise: 200_00 })
    expect(r.period).toBe('2026-09')
  })

  it('lists 3.2 by place of supply, exports and intra-state left out', () => {
    expect(r.unregisteredInterState).toEqual([
      { pos: '29', taxablePaise: 1_74_745_76, igstPaise: 31_454_24 },
    ])
  })

  it('writes a CSV the portal tiles can be read from', () => {
    const csv = gstr3bCsv(r, (pos) => (pos === '29' ? 'Karnataka' : ''))
    expect(csv).toContain(
      '"(a) Outward taxable supplies (other than zero rated, nil rated and exempted)",176645.76,31454.24,106.00,106.00,0.00',
    )
    expect(csv).toContain(',29-Karnataka,174745.76,31454.24')
  })
})

describe('GSTR-1 totals', () => {
  it('counts documents and sums each table', () => {
    const t = gstr1Totals(json)
    expect(t.map((x) => [x.table, x.documents, x.taxablePaise])).toEqual([
      ['b2b', 1, 1_000_00],
      ['b2cl', 1, 1_00_000_00],
      ['b2cs', 2, 85_745_76],
      ['exp', 1, 500_00],
      ['cdnr', 1, 100_00],
      ['cdnur', 1, 10_000_00],
      ['nil', 1, 200_00],
      ['hsn', 5, 1_77_345_76],
    ])
    expect(gstr1SummaryCsv(json).split('\n')[2]).toBe('b2b,1,1000.00,0.00,90.00,90.00,0.00')
  })
})

describe('return checks', () => {
  it('finds what the portal would refuse', () => {
    const noHsn = invoice('INV-8', { rows: [r1], lines: [line('', 1, r1), line('', 1, r1, true)] })
    const badGstin = invoice('INV-9', {
      buyerGstin: '27AAPFU0939F1ZX',
      rows: [r1],
      lines: [line('6109', 1, r1)],
    })
    const longNumber = invoice('INVOICE/2026-27/00001', {
      rows: [r1],
      lines: [line('6109', 1, r1)],
    })
    const oddRate = invoice('INV-10', { rows: [tax(13, 100, 0, 6)], lines: [line('6109', 1, r1)] })
    const comp = {
      ...invoice('INV-11', { rows: [r5], lines: [line('6109', 1, r5)] }),
      composition: true,
    }
    const all = [noHsn, badGstin, longNumber, oddRate, comp]
    const big = note('CN-9', inv1, [c1], [line('6109', 5, c1)])
    const out = gstReturnChecks({
      invoices: all,
      creditNotes: [big],
      gstr1: buildGstr1Json({
        gstin: GSTIN,
        period: '2026-09',
        invoices: all,
        creditNotes: [big],
        documents: [],
      }),
      businessWithoutGstin: ['INV-12'],
      cancelled: [
        { number: 'INV-13', afterFiling: false },
        { number: 'INV-14', afterFiling: true },
      ],
      orphanCreditNotes: ['CN-0'],
      hsnNetQuantities: hsnNetQuantities([badGstin], [big]),
    })
    expect(Object.fromEntries(out.map((w) => [w.code, w.numbers]))).toEqual({
      missing_hsn: ['INV-8'],
      invalid_buyer_gstin: ['INV-9'],
      business_without_gstin: ['INV-12'],
      bad_document_number: ['INVOICE/2026-27/00001'],
      bad_rate: ['INV-10'],
      cancelled: ['INV-13'],
      cancelled_after_filing: ['INV-14'],
      orphan_credit_note: ['CN-0'],
      negative_hsn_quantity: ['6109'],
      composition: ['INV-11'],
    })
  })

  it('is quiet for a clean month', () => {
    expect(gstReturnChecks({ invoices, creditNotes: notes, gstr1: json })).toEqual([])
  })
})
