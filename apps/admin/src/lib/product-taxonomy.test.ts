/** SOURCE OF TRUTH: category search — ranking and filtering over the vendored taxonomy. */
import { describe, expect, it } from 'bun:test'
import { findCategory, searchCategories, type TaxonomyCategory } from './product-taxonomy'

const categories: TaxonomyCategory[] = [
  { id: 'a-1', name: 'Shirts', path: 'Apparel & Accessories > Clothing > Shirts', parentId: 'a', level: 2 },
  {
    id: 'a-2',
    name: 'T-Shirts',
    path: 'Apparel & Accessories > Clothing > Shirts > T-Shirts',
    parentId: 'a-1',
    level: 3,
  },
  { id: 'b-1', name: 'Sneakers', path: 'Apparel & Accessories > Shoes > Sneakers', parentId: 'b', level: 2 },
  { id: 'a', name: 'Apparel & Accessories', path: 'Apparel & Accessories', parentId: null, level: 0 },
]

describe('searchCategories', () => {
  it('returns nothing for a blank query', () => {
    expect(searchCategories(categories, '')).toEqual([])
    expect(searchCategories(categories, '   ')).toEqual([])
  })

  it('ranks an exact name match first', () => {
    const results = searchCategories(categories, 'shirts')
    expect(results[0]?.id).toBe('a-1')
  })

  it('matches on the breadcrumb path, not just the leaf name', () => {
    const results = searchCategories(categories, 'shoes')
    expect(results.map((r) => r.id)).toContain('b-1')
  })

  it('is case-insensitive', () => {
    expect(searchCategories(categories, 'SNEAKERS')[0]?.id).toBe('b-1')
  })

  it('respects the limit', () => {
    expect(searchCategories(categories, 'a', 1)).toHaveLength(1)
  })

  it('finds nothing for an unmatched query', () => {
    expect(searchCategories(categories, 'zzz-not-a-category')).toEqual([])
  })
})

describe('findCategory', () => {
  it('returns null for a missing or null id', () => {
    expect(findCategory(categories, null)).toBeNull()
    expect(findCategory(categories, undefined)).toBeNull()
    expect(findCategory(categories, 'nope')).toBeNull()
  })

  it('finds the category by id', () => {
    expect(findCategory(categories, 'a-2')?.name).toBe('T-Shirts')
  })
})
