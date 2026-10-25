import { describe, expect, it } from 'vitest'
import { tabFromParam, tabOfError, tabsFor, tabsWithErrors } from './product-tab-list'

describe('product tabs', () => {
  it('swaps Price & stock for Variants once options exist', () => {
    expect(tabsFor(true)).toContain('price')
    expect(tabsFor(true)).not.toContain('variants')
    expect(tabsFor(false)).toContain('variants')
    expect(tabsFor(false)).not.toContain('price')
  })

  it('sends each error to the tab that holds its field', () => {
    expect(tabOfError('title', true)).toBe('overview')
    expect(tabOfError('package', false)).toBe('shipping')
    expect(tabOfError('preorderDeposit', true)).toBe('price')
    expect(tabOfError('preorderDeposit', false)).toBe('variants')
    expect(tabOfError('variants', true)).toBe('price')
    expect(tabOfError('variants', false)).toBe('variants')
  })

  it('lists failing tabs in page order', () => {
    expect(tabsWithErrors({ package: 'x', title: 'y' }, true)).toEqual(['overview', 'shipping'])
    expect(tabsWithErrors({}, true)).toEqual([])
  })

  it('opens old tab links on the merged tabs', () => {
    expect(tabFromParam('media', true)).toBe('overview')
    expect(tabFromParam('pricing', true)).toBe('price')
    expect(tabFromParam('inventory', false)).toBe('variants')
    expect(tabFromParam('seo', false)).toBe('seo')
    expect(tabFromParam(null, false)).toBe('overview')
    expect(tabFromParam('nope', true)).toBe('overview')
  })
})
