import { describe, expect, it } from 'vitest'
import { breadcrumbCollection } from './product-fields'

const c = (handle: string, title: string) => ({ handle, title })

describe('breadcrumbCollection', () => {
  const owned = [c('all', 'All'), c('atk', 'ATK'), c('mice', 'Gaming mice')]

  it("picks the vendor's brand collection, matched without case", () => {
    expect(breadcrumbCollection(owned, ' atk ')?.handle).toBe('atk')
  })

  it('falls back to the first collection that is not a catch-all list', () => {
    expect(breadcrumbCollection(owned, 'Razer')?.handle).toBe('atk')
    expect(breadcrumbCollection([c('all', 'All'), c('mice', 'Mice')], null)?.handle).toBe('mice')
  })

  it('uses a catch-all list only when the product is in nothing else', () => {
    expect(breadcrumbCollection([c('all', 'All')], 'ATK')?.handle).toBe('all')
    expect(breadcrumbCollection([], 'ATK')).toBeUndefined()
  })
})
