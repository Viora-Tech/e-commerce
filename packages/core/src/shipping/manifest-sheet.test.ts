/** SOURCE OF TRUTH: tests for ./manifest-sheet.ts and ./manifest-pdf.ts — the printed pickup manifest. */
import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import { manifestCells, manifestDate, manifestMoney, renderManifestSheet } from './manifest-pdf'
import {
  findManifestFor,
  groupManifestRows,
  type ManifestLine,
  manifestTotals,
  sameShipmentSet,
} from './manifest-sheet'

const line = (over: Partial<ManifestLine> = {}): ManifestLine => ({
  waybill: 'AWB1',
  orderNumber: 1047,
  shipToName: 'Asha Rao',
  city: 'Pune',
  pincode: '411001',
  weightGrams: 500,
  cod: false,
  codPaise: 0,
  ...over,
})

describe('groupManifestRows', () => {
  it('one group per courier pickup, in the order the rows came', () => {
    const rows = [
      { id: 'a', provider: 'delhivery', pickupId: 'p1' },
      { id: 'b', provider: 'shiprocket', pickupId: 'p2' },
      { id: 'c', provider: 'delhivery', pickupId: 'p1' },
      { id: 'd', provider: 'delhivery', pickupId: null },
    ]
    expect(
      groupManifestRows(rows).map((g) => [g.provider, g.pickupId, g.rows.map((r) => r.id)]),
    ).toEqual([
      ['delhivery', 'p1', ['a', 'c']],
      ['shiprocket', 'p2', ['b']],
      ['delhivery', null, ['d']],
    ])
  })
})

describe('findManifestFor', () => {
  const manifests = [
    { id: 'm2', provider: 'delhivery', shipmentIds: ['a', 'b', 'c'] },
    { id: 'm1', provider: 'delhivery', shipmentIds: ['b', 'a'] },
  ]

  it('reuses the manifest holding exactly those shipments, in any order', () => {
    expect(sameShipmentSet(['a', 'b'], ['b', 'a'])).toBe(true)
    expect(findManifestFor(manifests, 'delhivery', ['a', 'b'])?.id).toBe('m1')
  })

  it('a subset, a superset or another courier is a new manifest', () => {
    expect(findManifestFor(manifests, 'delhivery', ['a'])).toBeUndefined()
    expect(findManifestFor(manifests, 'delhivery', ['a', 'b', 'c', 'd'])).toBeUndefined()
    expect(findManifestFor(manifests, 'shiprocket', ['a', 'b'])).toBeUndefined()
  })
})

describe('manifestTotals', () => {
  it('counts parcels, COD parcels and amount, prepaid and known weight', () => {
    const t = manifestTotals([
      line({ cod: true, codPaise: 129_900, weightGrams: 750 }),
      line({ weightGrams: null }),
      line({ cod: true, codPaise: 50_050 }),
    ])
    expect(t).toEqual({
      parcels: 3,
      codParcels: 2,
      codPaise: 179_950,
      prepaidParcels: 1,
      weightGrams: 1250,
    })
  })
})

describe('manifest cells', () => {
  it('prints AWB, order, ship-to, city and PIN, weight and COD or Prepaid', () => {
    expect(manifestCells(line({ cod: true, codPaise: 129_900 }), 0)).toEqual([
      '1',
      'AWB1',
      '#1047',
      'Asha Rao',
      'Pune 411001',
      '0.50 kg',
      'COD Rs. 1,299',
    ])
    expect(manifestCells(line({ weightGrams: null, city: null, pincode: null }), 4)).toEqual([
      '5',
      'AWB1',
      '#1047',
      'Asha Rao',
      '-',
      '-',
      'Prepaid',
    ])
  })

  it('formats the pickup day and paise', () => {
    expect(manifestDate('2026-11-18')).toBe('18 Nov 2026')
    expect(manifestDate(null)).toBe('-')
    expect(manifestMoney(12_345_050)).toBe('Rs. 1,23,450.50')
  })
})

describe('renderManifestSheet', () => {
  it('one A4 page per pickup, more when the list runs long, and a name in Devanagari', async () => {
    const pdf = await renderManifestSheet(
      [
        {
          manifestId: '0f1e2d3c-0000-0000-0000-000000000000',
          courier: 'Delhivery',
          pickupDate: '2026-11-18',
          pickupPlace: 'Main warehouse',
          lines: [line({ shipToName: 'आशा राव' }), line({ cod: true, codPaise: 49_900 })],
        },
        {
          manifestId: '1f1e2d3c-0000-0000-0000-000000000000',
          courier: 'Shiprocket (Blue Dart)',
          pickupDate: null,
          pickupPlace: null,
          lines: Array.from({ length: 60 }, (_, i) => line({ waybill: `AWB${i}` })),
        },
      ],
      { storeName: 'Waimers', printedAt: '18 Nov 2026, 3:05 pm' },
    )
    const doc = await PDFDocument.load(pdf)
    expect(doc.getPageCount()).toBe(3)
    const [w, h] = [doc.getPage(0).getWidth(), doc.getPage(0).getHeight()]
    expect([Math.round(w), Math.round(h)]).toEqual([595, 842])
  })
})
