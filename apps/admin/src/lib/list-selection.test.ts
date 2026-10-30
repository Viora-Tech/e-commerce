import { describe, expect, it } from 'vitest'
import { listSelection, publishListSelection } from './list-selection'

describe('list selection for the AI assistant (#983)', () => {
  it('gives the ticked ids only on the page that published them', () => {
    publishListSelection('/products', ['a', 'b'])
    expect(listSelection('/products')).toEqual(['a', 'b'])
    expect(listSelection('/orders')).toEqual([])
  })

  it('is replaced by the newest selection, so an earlier one never leaks', () => {
    publishListSelection('/products', ['old'])
    publishListSelection('/products', ['new-1', 'new-2'])
    expect(listSelection('/products')).toEqual(['new-1', 'new-2'])
    publishListSelection('/products', [])
    expect(listSelection('/products')).toEqual([])
  })
})
