'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { Input } from '@commerce/ui/shadcn/input'
import { Popover, PopoverContent, PopoverTrigger } from '@commerce/ui/shadcn/popover'
import { useState } from 'react'
import PillTabs from '@/components/layout/pill-tabs'
import { analyticsContent as copy, RANGE_KEYS } from '@/data/analytics'
import type { RangeState } from '@/lib/analytics-range'

type RangePickerProps = {
  value: RangeState
  onChange: (next: RangeState) => void
}

const todayIso = () => new Date().toISOString().slice(0, 10)

/** Range tabs plus a custom from/to popover; the choice lives in the URL. */
export default function RangePicker({ value, onChange }: RangePickerProps) {
  // Hooks
  const [from, setFrom] = useState(value.from ?? todayIso())
  const [to, setTo] = useState(value.to ?? todayIso())
  const [open, setOpen] = useState(false)

  // Event handlers
  const handleApply = () => {
    onChange({ key: 'custom', from, to })
    setOpen(false)
  }

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
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button variant="outline" size="sm">
              {value.key === 'custom' ? `${value.from} to ${value.to}` : copy.ranges.custom}
            </Button>
          }
        />
        <PopoverContent align="end" className="w-72 space-y-3">
          <div className="space-y-1">
            <label htmlFor="range-from" className="block text-caption text-muted-foreground">
              {copy.ranges.from}
            </label>
            <Input
              id="range-from"
              type="date"
              value={from}
              max={to}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="range-to" className="block text-caption text-muted-foreground">
              {copy.ranges.to}
            </label>
            <Input
              id="range-to"
              type="date"
              value={to}
              min={from}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <Button className="w-full" onClick={handleApply}>
            {copy.ranges.apply}
          </Button>
        </PopoverContent>
      </Popover>
    </div>
  )
}
