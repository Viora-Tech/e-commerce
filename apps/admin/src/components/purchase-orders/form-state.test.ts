/** SOURCE OF TRUTH: purchase order form state: adding lines from the Select products dialog */
import { describe, expect, it } from 'vitest'
import { addPickedLines, type PickedForPo, type PoLine } from './form-state'

const product = (
  title: string,
  variants: { id: string; title: string; costPaise?: number | null }[],
) => ({
  id: `p-${title}`,
  title,
  imageUrl: `https://cdn.example/${title}.jpg`,
  variants: variants.map((v) => ({
    id: v.id,
    title: v.title,
    sku: `SKU-${v.id}`,
    costPaise: v.costPaise ?? null,
  })),
})

const existing: PoLine = {
  variantId: 'a1',
  productId: 'p-Pad',
  productTitle: 'Pad',
  variantTitle: 'Black',
  sku: 'SKU-a1',
  imageUrl: null,
  quantity: '5',
  unitPrice: '450',
  hsnCode: '85044030',
  received: 0,
  rejected: 0,
}

describe('addPickedLines', () => {
  it('adds only the ticked variants, in the dialog order, after the existing lines', () => {
    const picked: PickedForPo = [
      {
        product: product('Pad', [
          { id: 'a1', title: 'Black' },
          { id: 'a2', title: 'White', costPaise: 50_050 },
          { id: 'a3', title: 'Red' },
        ]),
        variantIds: ['a2'],
      },
      {
        product: product('Sleeve', [{ id: 'b1', title: 'Default', costPaise: 12_000 }]),
        variantIds: ['b1'],
      },
    ]
    const lines = addPickedLines([existing], picked, 'INR')
    expect(lines.map((l) => l.variantId)).toEqual(['a1', 'a2', 'b1'])
    expect(lines[0]).toBe(existing)
    expect(lines[1]).toMatchObject({
      productTitle: 'Pad',
      variantTitle: 'White',
      sku: 'SKU-a2',
      imageUrl: 'https://cdn.example/Pad.jpg',
      quantity: '1',
      unitPrice: '500.5',
      hsnCode: '',
      received: 0,
      rejected: 0,
    })
    expect(lines[2]?.unitPrice).toBe('120')
  })

  it('skips variants already on the order and repeated picks instead of doubling them', () => {
    const pad = product('Pad', [
      { id: 'a1', title: 'Black', costPaise: 100 },
      { id: 'a2', title: 'White' },
    ])
    const lines = addPickedLines(
      [existing],
      [
        { product: pad, variantIds: ['a1', 'a2'] },
        { product: pad, variantIds: ['a2'] },
      ],
      'INR',
    )
    expect(lines.map((l) => l.variantId)).toEqual(['a1', 'a2'])
    expect(lines[0]?.quantity).toBe('5')
  })

  it('leaves the price blank for a foreign currency or a variant with no cost', () => {
    const pad = product('Pad', [
      { id: 'a2', title: 'White', costPaise: 50_000 },
      { id: 'a3', title: 'Red', costPaise: null },
    ])
    const usd = addPickedLines([], [{ product: pad, variantIds: ['a2', 'a3'] }], 'USD')
    expect(usd.map((l) => l.unitPrice)).toEqual(['', ''])
    const inr = addPickedLines([], [{ product: pad, variantIds: ['a3'] }], 'INR')
    expect(inr[0]?.unitPrice).toBe('')
  })

  it('returns the same lines when nothing new was ticked', () => {
    expect(addPickedLines([existing], [], 'INR')).toEqual([existing])
  })
})
