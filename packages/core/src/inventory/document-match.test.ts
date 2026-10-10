/** SOURCE OF TRUTH: tests for document line matching and the printed-amount rules */
import { describe, expect, it } from 'vitest'
import { type MatchCandidate, matchDocumentLines } from './document-match'
import { printedRate, printedToMinor, shapeForKind } from './document-rules'

const line = (over: Partial<MatchCandidate>): MatchCandidate => ({
  lineId: 'l1',
  variantId: 'v1',
  sku: null,
  title: '',
  hsnCode: null,
  ...over,
})

describe('matchDocumentLines', () => {
  const candidates = [
    line({ lineId: 'mouse', variantId: 'vm', sku: 'M1-BLK', title: 'Wireless Mouse / Black' }),
    line({
      lineId: 'keys',
      variantId: 'vk',
      sku: 'KB-02',
      title: 'Mechanical Keyboard / Red',
      hsnCode: '84716040',
    }),
    line({ lineId: 'pad', variantId: 'vp', sku: null, title: 'Desk pad XL' }),
  ]

  it('matches by supplier code first, ignoring case, spaces and dashes', () => {
    const [m] = matchDocumentLines(
      [{ sku: 'm1 blk', description: 'Something else entirely', hsnCode: null }],
      candidates,
    )
    expect(m).toMatchObject({ lineId: 'mouse', variantId: 'vm', method: 'sku', score: 1 })
  })

  it('falls back to HSN plus a fuzzy title, then the title alone', () => {
    const matches = matchDocumentLines(
      [
        { sku: 'K2-RED', description: 'Mechanical keyboard K2, red switches', hsnCode: '847160' },
        { sku: null, description: 'Desk pad, size XL', hsnCode: null },
      ],
      candidates,
    )
    expect(matches[0]).toMatchObject({ lineId: 'keys', method: 'hsn_title' })
    expect(matches[1]).toMatchObject({ lineId: 'pad', method: 'title' })
  })

  it('leaves a line unmatched rather than guess, and uses each order line once', () => {
    const matches = matchDocumentLines(
      [
        { sku: 'M1-BLK', description: null, hsnCode: null },
        { sku: 'M1-BLK', description: 'USB cable', hsnCode: null },
        { sku: null, description: 'Gaming chair', hsnCode: '940130' },
      ],
      candidates,
    )
    expect(matches.map((m) => m.method)).toEqual(['sku', 'none', 'none'])
    expect(matches[1]).toMatchObject({ lineId: null, variantId: null, score: 0 })
  })

  it('finds a store product by SKU that is not on the order yet', () => {
    const [m] = matchDocumentLines(
      [{ sku: 'CAB-1', description: 'Cable', hsnCode: null }],
      [...candidates, line({ lineId: null, variantId: 'vc', sku: 'CAB-1', title: 'Cable' })],
    )
    expect(m).toMatchObject({ lineId: null, variantId: 'vc', method: 'sku' })
  })

  it('scores titles by shared words, ignoring case', () => {
    const pad = [line({ lineId: 'pad', variantId: 'vp', title: 'Wireless MOUSE' })]
    const [same] = matchDocumentLines(
      [{ sku: null, description: 'wireless mouse', hsnCode: null }],
      pad,
    )
    expect(same).toMatchObject({ method: 'title', score: 1 })
    const [none] = matchDocumentLines([{ sku: null, description: '', hsnCode: null }], pad)
    expect(none?.method).toBe('none')
  })
})

describe('printed amounts', () => {
  it('turns printed amounts into minor units without float drift', () => {
    expect(printedToMinor(12.4, 'USD')).toBe(1240)
    expect(printedToMinor(0.29, 'USD')).toBe(29)
    expect(printedToMinor(20219.76, 'INR')).toBe(2_021_976)
    expect(printedToMinor(1500, 'JPY')).toBe(1500)
    expect(printedToMinor(-3.5, 'INR')).toBe(-350)
    expect(printedToMinor(null, 'INR')).toBeNull()
    expect(printedToMinor(Number.NaN, 'INR')).toBeNull()
  })

  it('keeps a rate as six-decimal text', () => {
    expect(printedRate(83.25)).toBe('83.25')
    expect(printedRate(83)).toBe('83')
    expect(printedRate(11.123456789)).toBe('11.123457')
    expect(printedRate(0)).toBeNull()
  })

  it('reads every bill that is not goods or customs as a service bill', () => {
    expect(shapeForKind('supplier_invoice')).toBe('supplier_invoice')
    expect(shapeForKind('bill_of_entry')).toBe('bill_of_entry')
    expect(shapeForKind('cha_bill')).toBe('service_bill')
    expect(shapeForKind('other')).toBe('service_bill')
  })
})
