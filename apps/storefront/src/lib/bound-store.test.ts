import { describe, expect, it } from 'vitest'
import { boundStoreId } from './bound-store'

describe('boundStoreId', () => {
  it('accepts the bound store only when it is the one this hostname serves', () => {
    expect(boundStoreId('store-a', 'store-a')).toBe('store-a')
    expect(boundStoreId('store-b', 'store-a')).toBeNull()
    expect(boundStoreId('store-a', null)).toBeNull()
    expect(boundStoreId(undefined, 'store-a')).toBeNull()
  })
})
