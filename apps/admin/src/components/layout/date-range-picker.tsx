'use client'

import { ChevronDown, Clock } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import { Calendar } from '@commerce/ui/shadcn/calendar'
import { NativeSelect, NativeSelectOption } from '@commerce/ui/shadcn/native-select'
import { Popover, PopoverContent, PopoverTrigger } from '@commerce/ui/shadcn/popover'
import { Switch } from '@commerce/ui/shadcn/switch'
import { useId, useState } from 'react'
import { dateRangeContent } from '@/data/date-range'
import { useCopy, useFormat } from '@/hooks/use-copy'
import {
  type HomeRange,
  istToday,
  RANGE_PRESETS,
  type RangeCompare,
  type RangePreset,
  rangeFor,
} from '@/lib/home-range'

type DateRangePickerProps = {
  range: HomeRange
  /** Leave out to hide the "Compare to" row (pages that don't chart a comparison). */
  compare?: RangeCompare
  onApply: (range: HomeRange, compare: RangeCompare) => void
  /** Which presets to list (default: all of them, Figma order). */
  presets?: readonly RangePreset[]
  /** The trigger's classes; defaults to an outline sm button. */
  className?: string
}

const TRIGGER =
  'inline-flex h-8 items-center gap-1.5 rounded-md border border-input bg-card px-3 text-body font-medium transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-4'

/* Presets in Figma order, with a divider before each group. */
const GROUP_STARTS: readonly RangePreset[] = ['thisQuarter', 'diwali', 'custom']

const SHORT = { day: 'numeric', month: 'short' } as const
const LONG = { day: 'numeric', month: 'short', year: 'numeric' } as const

/** The month before `d`, so the picker shows last month beside this one (Figma). */
function monthBefore(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() - 1, 1)
}

/** An ISO date as a local midnight Date for the calendar, and back. */
function toDate(iso: string): Date {
  return new Date(`${iso}T00:00:00`)
}

function toIso(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/**
 * Figma 580:692 "Today ▾": presets on the left (Today … This financial year, Diwali week,
 * Festive season, Custom range), two months of calendar on the right, then "Compare to" with
 * the previous period or the same dates last year. Nothing changes until Apply.
 */
export default function DateRangePicker({
  range,
  compare,
  onApply,
  presets = RANGE_PRESETS,
  className,
}: DateRangePickerProps) {
  // Hooks
  const copy = useCopy(dateRangeContent)
  const fmt = useFormat()
  const switchId = useId()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(range)
  const [comparing, setComparing] = useState(compare !== 'none')
  const [against, setAgainst] = useState<Exclude<RangeCompare, 'none'>>(
    compare === 'year' ? 'year' : 'previous',
  )

  // Event handlers
  const handleOpenChange = (next: boolean) => {
    if (next) {
      setDraft(range)
      setComparing(compare !== 'none')
      setAgainst(compare === 'year' ? 'year' : 'previous')
    }
    setOpen(next)
  }

  const handlePreset = (preset: RangePreset) => {
    setDraft(preset === 'custom' ? { ...draft, preset } : rangeFor(preset))
  }

  const handleDays = (picked: { from?: Date | undefined; to?: Date | undefined } | undefined) => {
    if (!picked?.from) return
    const from = toIso(picked.from)
    setDraft({ preset: 'custom', from, to: picked.to ? toIso(picked.to) : from })
  }

  const handleApply = () => {
    onApply(draft, compare !== undefined && comparing ? against : 'none')
    setOpen(false)
  }

  // Render logic
  const label =
    range.preset === 'custom'
      ? `${fmt.pattern(toDate(range.from), SHORT)} – ${fmt.pattern(toDate(range.to), SHORT)}`
      : copy.ranges[range.preset]
  const today = toDate(istToday())

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger aria-label={copy.rangeLabel} className={className ?? TRIGGER}>
        <Clock aria-hidden="true" />
        {label}
        <ChevronDown className="text-muted-foreground" aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        className="flex w-auto max-w-[calc(100vw-2rem)] flex-row items-stretch gap-0 overflow-hidden p-0"
      >
        <ul className="hidden w-52 shrink-0 flex-col gap-0.5 border-border border-r p-1.5 sm:flex">
          {presets.map((preset) => (
            <li key={preset} className={cn(GROUP_STARTS.includes(preset) && 'mt-1.5')}>
              <button
                type="button"
                onClick={() => handlePreset(preset)}
                className={cn(
                  'flex h-8 w-full items-center justify-between rounded-sm px-2.5 text-left text-body transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  draft.preset === preset && 'bg-muted font-medium',
                )}
              >
                {copy.ranges[preset]}
                {preset === 'festive' ? (
                  <span className="text-xs text-muted-foreground">{copy.festiveHint}</span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
        <div className="flex min-w-0 flex-col gap-3 p-3">
          <div className="flex items-center gap-2 text-body">
            <span className="flex h-8 flex-1 items-center rounded-sm border border-input px-2.5 tabular-nums">
              <span className="sr-only">{copy.from} </span>
              {fmt.pattern(toDate(draft.from), LONG)}
            </span>
            <span aria-hidden="true" className="text-muted-foreground">
              →
            </span>
            <span className="flex h-8 flex-1 items-center rounded-sm border border-input px-2.5 tabular-nums">
              <span className="sr-only">{copy.to} </span>
              {fmt.pattern(toDate(draft.to), LONG)}
            </span>
          </div>
          <Calendar
            mode="range"
            numberOfMonths={2}
            defaultMonth={monthBefore(toDate(draft.to))}
            selected={{ from: toDate(draft.from), to: toDate(draft.to) }}
            onSelect={handleDays}
            disabled={{ after: today }}
            className="p-0"
          />
          <div className="flex flex-wrap items-center gap-2 border-border border-t pt-3">
            {compare !== undefined ? (
              <>
                <span className="flex items-center gap-2 text-body">
                  <Switch id={switchId} checked={comparing} onCheckedChange={setComparing} />
                  <label htmlFor={switchId}>{copy.compareTo}</label>
                </span>
                <NativeSelect
                  size="sm"
                  aria-label={copy.compareTo}
                  value={against}
                  disabled={!comparing}
                  onChange={(e) => setAgainst(e.target.value === 'year' ? 'year' : 'previous')}
                >
                  <NativeSelectOption value="previous">
                    {copy.compareOptions.previous}
                  </NativeSelectOption>
                  <NativeSelectOption value="year">{copy.compareOptions.year}</NativeSelectOption>
                </NativeSelect>
              </>
            ) : null}
            <span className="flex-1" />
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              {copy.cancel}
            </Button>
            <Button size="sm" onClick={handleApply}>
              {copy.apply}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
