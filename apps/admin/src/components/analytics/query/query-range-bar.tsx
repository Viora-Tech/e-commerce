'use client'

import {
  COMPARE_OPTIONS,
  type ParsedQuery,
  type QueryCompare,
  queryDay,
  rangeKeyOf,
  rangeTimes,
  setCompare,
  setRange,
} from '@commerce/core/analytics-query'
import { cn } from '@commerce/ui/lib/utils'
import { NativeSelect, NativeSelectOption } from '@commerce/ui/shadcn/native-select'
import { analyticsContent } from '@/data/analytics'
import { useCopy } from '@/hooks/use-copy'
import type { RangeState } from '@/lib/analytics-range'
import RangePicker from '../range-picker'

type QueryRangeBarProps = {
  query: ParsedQuery
  /** False while the text does not parse. */
  enabled: boolean
  onChange: (next: ParsedQuery) => void
}

/** SINCE / UNTIL as the Reports range: a quick key when it is one, else the two days. */
function toRange(q: ParsedQuery): RangeState {
  const key = rangeKeyOf(q)
  return key ? { key } : { key: 'custom', from: queryDay(q.since), to: queryDay(q.until) }
}

/** Shopify-style pills above the editor: the date range and Compare, read from and written to the query. */
export default function QueryRangeBar({ query, enabled, onChange }: QueryRangeBarProps) {
  // Hooks
  const copy = useCopy(analyticsContent.query.compare)

  // Event handlers
  const handleRange = (range: RangeState) => {
    if (range.key !== 'custom') {
      const { since, until } = rangeTimes(range.key)
      onChange(setRange(query, since, until))
    } else if (range.from && range.to) {
      onChange(setRange(query, { kind: 'date', iso: range.from }, { kind: 'date', iso: range.to }))
    }
  }

  // Render logic
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2',
        !enabled && 'pointer-events-none opacity-50',
      )}
      aria-disabled={!enabled || undefined}
    >
      <RangePicker value={toRange(query)} onChange={handleRange} />
      <NativeSelect
        size="sm"
        aria-label={copy.label}
        disabled={!enabled}
        value={query.compare ?? ''}
        onChange={(e) =>
          onChange(setCompare(query, (e.target.value || null) as QueryCompare | null))
        }
      >
        <NativeSelectOption value="">{copy.none}</NativeSelectOption>
        {COMPARE_OPTIONS.map((o) => (
          <NativeSelectOption key={o} value={o}>
            {copy[o]}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  )
}
