import { formatMoney } from '@commerce/money'
import { describe, expect, it } from 'vitest'
import { filterPanelContent } from '@/data/filter-panel'
import { chipFor, chipGroups, clearGroup, hasFilter } from './applied'
import { DATE_CUSTOM, type FilterGroup } from './types'

const noop = () => {}

function paymentGroup(value: string[]): FilterGroup {
  return {
    key: 'payment',
    label: 'Payment',
    type: 'checks',
    options: [
      { value: 'paid', label: 'Paid' },
      { value: 'pending', label: 'Pending' },
    ],
    value,
    onChange: noop,
  }
}

function totalGroup(from: string, to: string): FilterGroup {
  return {
    key: 'total',
    label: 'Order value',
    type: 'range',
    input: 'money',
    from,
    to,
    onChange: noop,
  }
}

function dateGroup(preset: string | null, from = '', to = ''): FilterGroup {
  return {
    key: 'date',
    label: 'Date',
    type: 'date',
    presets: [{ value: '7d', label: 'Last 7 days' }],
    value: { preset, from, to },
    onChange: noop,
    anyLabel: 'Any date',
  }
}

describe('hasFilter', () => {
  it('is true only while a group narrows the list', () => {
    expect(hasFilter(paymentGroup([]))).toBe(false)
    expect(hasFilter(paymentGroup(['paid']))).toBe(true)
    expect(hasFilter(totalGroup('', ''))).toBe(false)
    expect(hasFilter(totalGroup('', '2000'))).toBe(true)
    expect(hasFilter(dateGroup(null))).toBe(false)
    expect(hasFilter(dateGroup('7d'))).toBe(true)
    // Custom picked but no dates typed yet: no filter.
    expect(hasFilter(dateGroup(DATE_CUSTOM))).toBe(false)
    expect(hasFilter(dateGroup(DATE_CUSTOM, '2026-10-01'))).toBe(true)
    expect(hasFilter({ key: 'q', label: 'SKU', type: 'text', value: '  ', onChange: noop })).toBe(
      false,
    )
    expect(
      hasFilter({ key: 'gst', label: 'GST', type: 'boolean', value: false, onChange: noop }),
    ).toBe(true)
  })
})

describe('chipGroups', () => {
  const groups = [paymentGroup([]), totalGroup('500', ''), dateGroup(null)]

  it('shows applied filters in the list order', () => {
    expect(chipGroups(groups, null).map((g) => g.key)).toEqual(['total'])
  })

  it('keeps a just-picked empty filter in its place while its popover is open', () => {
    expect(chipGroups(groups, 'payment').map((g) => g.key)).toEqual(['payment', 'total'])
    expect(chipGroups(groups, 'date').map((g) => g.key)).toEqual(['total', 'date'])
  })

  it('does not duplicate a picked filter that is already applied', () => {
    expect(chipGroups(groups, 'total').map((g) => g.key)).toEqual(['total'])
  })
})

describe('chip labels', () => {
  it('formats money bounds with @commerce/money when the group has no format', () => {
    const chip = chipFor(totalGroup('500', '2000'), filterPanelContent)
    expect(chip?.label).toBe(`${formatMoney(50000)}–${formatMoney(200000)}`)
    expect(chip?.field).toBe('Order value')
  })

  it('names the ticked options', () => {
    expect(chipFor(paymentGroup(['paid']), filterPanelContent)?.label).toBe('Paid')
    expect(chipFor(paymentGroup([]), filterPanelContent)).toBeNull()
  })
})

describe('clearGroup', () => {
  it('empties only the one group', () => {
    const changes: unknown[] = []
    clearGroup({ ...totalGroup('5', '9'), onChange: (p) => changes.push(p) })
    clearGroup({
      key: 'min',
      label: 'Orders',
      type: 'range',
      input: 'number',
      from: '2',
      onChange: (p) => changes.push(p),
    })
    expect(changes).toEqual([{ from: '', to: '' }, { from: '' }])
  })
})
