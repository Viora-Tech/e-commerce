import { describe, expect, it } from 'vitest'
import { filterPanelContent } from '@/data/filter-panel'
import { appliedFromGroups, clearGroups } from './applied'
import { DATE_CUSTOM, type FilterGroup } from './types'

const options = ['Asus', 'Logitech', 'Razer', 'Zowie'].map((v) => ({ value: v, label: v }))

function groups(changes: unknown[]): FilterGroup[] {
  return [
    {
      key: 'vendor',
      label: 'Vendor',
      type: 'multi',
      options,
      value: ['Asus', 'Logitech', 'Razer'],
      onChange: (v) => changes.push(['vendor', v]),
    },
    {
      key: 'created',
      label: 'Created',
      type: 'date',
      presets: [{ value: '7d', label: 'Last 7 days' }],
      value: { preset: DATE_CUSTOM, from: '2026-10-01', to: '' },
      onChange: (v) => changes.push(['created', v]),
      anyLabel: 'Any date',
    },
    {
      key: 'gst',
      label: 'Business',
      type: 'boolean',
      value: false,
      onChange: (v) => changes.push(['gst', v]),
    },
  ]
}

describe('applied chips for the new filter types', () => {
  it('names the first two values of a long list, a custom date range, and yes or no', () => {
    const chips = appliedFromGroups(groups([]), filterPanelContent)
    expect(chips.map((c) => [c.field, c.label])).toEqual([
      ['Vendor', 'Asus, Logitech +1'],
      ['Created', '≥ 2026-10-01'],
      ['Business', 'No'],
    ])
  })

  it('names a date preset by its label', () => {
    const [, created] = groups([])
    if (created?.type !== 'date') throw new Error('date group')
    const chips = appliedFromGroups(
      [{ ...created, value: { preset: '7d', from: '', to: '' } }],
      filterPanelContent,
    )
    expect(chips[0]?.label).toBe('Last 7 days')
  })

  it('clears each type to no filter', () => {
    const changes: unknown[] = []
    clearGroups(groups(changes))
    expect(changes).toEqual([
      ['vendor', []],
      ['created', { preset: null, from: '', to: '' }],
      ['gst', null],
    ])
  })
})
