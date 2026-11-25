import { describe, expect, it } from 'vitest'
import { priceChangedNote } from './price-changed'

describe('priceChangedNote (owner, 24 Nov 2026)', () => {
  it('says neutrally that the price changed since the item was added', () => {
    expect(priceChangedNote('en')).toBe('The price of this item has changed since you added it.')
    expect(priceChangedNote(null)).toBe('The price of this item has changed since you added it.')
  })

  it('reads in Hindi for a Hindi-market shopper', () => {
    expect(priceChangedNote('hi')).toBe('आपके जोड़ने के बाद इस सामान की कीमत बदल गई है।')
  })
})
