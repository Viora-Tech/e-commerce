import { describe, expect, it } from 'vitest'
import {
  COLLECTION_OPS_BY_FIELD,
  type CollectionRules,
  emptyCollectionRules,
  evaluateRules,
  matchesCollectionCondition,
  type RuleProduct,
  selectMembers,
} from './rules'

const pad: RuleProduct = {
  title: 'Maboroshi Gaming Mousepad',
  productType: 'Mouse Pad',
  vendor: 'Talongames',
  tags: ['mousepad', 'Speed'],
  pricePaise: 199900,
}

const rules = (partial: Partial<CollectionRules>): CollectionRules => ({
  match: 'all',
  conditions: [],
  ...partial,
})

describe('collection rules', () => {
  it('matches text fields case insensitively', () => {
    expect(matchesCollectionCondition(pad, { field: 'type', op: 'eq', value: 'mouse pad' })).toBe(
      true,
    )
    expect(
      matchesCollectionCondition(pad, { field: 'vendor', op: 'eq', value: 'TALONGAMES' }),
    ).toBe(true)
    expect(
      matchesCollectionCondition(pad, { field: 'title', op: 'contains', value: 'gaming' }),
    ).toBe(true)
    expect(
      matchesCollectionCondition(pad, { field: 'title', op: 'starts_with', value: 'Mab' }),
    ).toBe(true)
    expect(
      matchesCollectionCondition(pad, { field: 'title', op: 'starts_with', value: 'pad' }),
    ).toBe(false)
  })

  it('treats neq as true when the field is empty', () => {
    const noVendor = { ...pad, vendor: null }
    expect(
      matchesCollectionCondition(noVendor, { field: 'vendor', op: 'neq', value: 'Talongames' }),
    ).toBe(true)
    expect(
      matchesCollectionCondition(pad, { field: 'vendor', op: 'neq', value: 'Talongames' }),
    ).toBe(false)
  })

  it('matches a tag only on an exact value', () => {
    expect(matchesCollectionCondition(pad, { field: 'tag', op: 'eq', value: 'speed' })).toBe(true)
    expect(matchesCollectionCondition(pad, { field: 'tag', op: 'eq', value: 'spee' })).toBe(false)
    expect(matchesCollectionCondition(pad, { field: 'tag', op: 'neq', value: 'keyboard' })).toBe(
      true,
    )
  })

  it('compares price in paise from a rupee value', () => {
    expect(matchesCollectionCondition(pad, { field: 'price', op: 'gt', value: '1500' })).toBe(true)
    expect(matchesCollectionCondition(pad, { field: 'price', op: 'lt', value: '1500' })).toBe(false)
    expect(matchesCollectionCondition(pad, { field: 'price', op: 'eq', value: '1999' })).toBe(true)
    expect(matchesCollectionCondition(pad, { field: 'price', op: 'eq', value: '₹1,999' })).toBe(
      true,
    )
  })

  it('never matches a price rule when the product has no variants', () => {
    const draft = { ...pad, pricePaise: null }
    expect(matchesCollectionCondition(draft, { field: 'price', op: 'gt', value: '1' })).toBe(false)
  })

  it('requires every condition under match all', () => {
    const r = rules({
      conditions: [
        { field: 'type', op: 'eq', value: 'Mouse Pad' },
        { field: 'price', op: 'gt', value: '5000' },
      ],
    })
    expect(evaluateRules(pad, r)).toBe(false)
    expect(evaluateRules(pad, { ...r, match: 'any' })).toBe(true)
  })

  it('holds no members until a condition is written', () => {
    expect(evaluateRules(pad, emptyCollectionRules())).toBe(false)
    expect(
      evaluateRules(pad, rules({ conditions: [{ field: 'tag', op: 'eq', value: '  ' }] })),
    ).toBe(false)
  })

  it('selects members in catalogue order', () => {
    const keyboard: RuleProduct = {
      title: 'Wraith W65 Keyboard',
      productType: 'Keyboard',
      vendor: 'Wraith',
      tags: [],
      pricePaise: 899900,
    }
    const members = selectMembers(
      [pad, keyboard],
      rules({ conditions: [{ field: 'type', op: 'contains', value: 'pad' }] }),
    )
    expect(members).toEqual([pad])
  })

  it('offers only sensible operators per field', () => {
    expect(COLLECTION_OPS_BY_FIELD.price).not.toContain('contains')
    expect(COLLECTION_OPS_BY_FIELD.tag).toEqual(['eq', 'neq'])
  })
})
