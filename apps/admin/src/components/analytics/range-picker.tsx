'use client'

import DateRangePicker from '@/components/layout/date-range-picker'
import PillTabs from '@/components/layout/pill-tabs'
import { analyticsContent as copy, RANGE_KEYS } from '@/data/analytics'
import type { RangeState } from '@/lib/analytics-range'
import { addDays, type HomeRange, istToday, rangeFor } from '@/lib/home-range'

type RangePickerProps = {
  value: RangeState
  onChange: (next: RangeState) => void
}

/** The analytics range as the shared picker's from–to pair. */
function toPickerRange(value: RangeState): HomeRange {
  if (value.key === 'custom' && value.from && value.to) {
    return { preset: 'custom', from: value.from, to: value.to }
  }
  if (value.key === '90d') {
    const to = istToday()
    return { preset: 'custom', from: addDays(to, -89), to }
  }
  return rangeFor(value.key === 'custom' ? '30d' : value.key)
}

/** A picked range back as the URL's range: the quick keys stay keys, anything else is custom. */
function fromPickerRange(range: HomeRange): RangeState {
  if (range.preset === 'today' || range.preset === '7d' || range.preset === '30d') {
    return { key: range.preset }
  }
  return { key: 'custom', from: range.from, to: range.to }
}

/** Quick range tabs plus the shared date-range picker; the choice lives in the URL. */
export default function RangePicker({ value, onChange }: RangePickerProps) {
  // Event handlers
  const handleApply = (range: HomeRange) => onChange(fromPickerRange(range))

  // Render logic
  const tabs = RANGE_KEYS.map((key) => ({ value: key as string | null, label: copy.ranges[key] }))

  return (
    <div className="flex flex-wrap items-center gap-2">
      <PillTabs
        variant="segmented"
        tabs={tabs}
        value={value.key === 'custom' ? null : value.key}
        onChange={(key) => onChange({ key: (key ?? '30d') as RangeState['key'] })}
      />
      <DateRangePicker range={toPickerRange(value)} onApply={handleApply} />
    </div>
  )
}
