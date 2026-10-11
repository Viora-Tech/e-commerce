import { describe, expect, it } from 'vitest'
import { tabOfError, tabsFor, tabsWithErrors } from './product-tab-list'

describe('product tabs', () => {
  it('drops pricing and inventory once options exist', () => {
    expect(tabsFor(true)).toContain('pricing')
    expect(tabsFor(false)).not.toContain('pricing')
    expect(tabsFor(false)).not.toContain('inventory')
  })

  it('sends each error to the tab that holds its field', () => {
    expect(tabOfError('title', true)).toBe('details')
    expect(tabOfError('package', false)).toBe('shipping')
    expect(tabOfError('preorderDeposit', true)).toBe('more')
    expect(tabOfError('variants', true)).toBe('pricing')
    expect(tabOfError('variants', false)).toBe('variants')
  })

  it('lists failing tabs in page order', () => {
    expect(tabsWithErrors({ preorderDeposit: 'x', title: 'y' }, true)).toEqual(['details', 'more'])
    expect(tabsWithErrors({}, true)).toEqual([])
  })
})
