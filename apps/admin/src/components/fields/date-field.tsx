'use client'

import { ChevronLeftIcon, ChevronRight, Clock } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import { Calendar } from '@commerce/ui/shadcn/calendar'
import { Input } from '@commerce/ui/shadcn/input'
import { Popover, PopoverContent, PopoverTrigger } from '@commerce/ui/shadcn/popover'
import { useState } from 'react'
import { dateFieldContent } from '@/data/common'
import { useCopy, useFormat } from '@/hooks/use-copy'

type DateFieldProps = {
  /**
   * The same strings the native inputs used, so callers swap it in as is: `yyyy-mm-dd`
   * (date), `yyyy-mm` (month) or `yyyy-mm-ddThh:mm` (datetime, wall time). Empty for none.
   */
  value: string
  onChange: (value: string) => void
  mode?: 'date' | 'month' | 'datetime'
  id?: string | undefined
  /** Earliest and latest pickable day, as `yyyy-mm-dd` (or `yyyy-mm` in month mode). */
  min?: string | undefined
  max?: string | undefined
  placeholder?: string | undefined
  disabled?: boolean | undefined
  /** Offer "Clear" (optional fields). */
  clearable?: boolean | undefined
  invalid?: boolean | undefined
  className?: string | undefined
  'aria-label'?: string | undefined
  'aria-invalid'?: boolean | undefined
}

const TRIGGER =
  'flex h-9 w-full min-w-0 items-center gap-2 rounded-md border border-input bg-input-surface px-3 text-left text-body text-foreground shadow-input transition-[color,border-color,box-shadow] outline-none hover:border-border-strong focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive'

const DAY = { day: 'numeric', month: 'short', year: 'numeric' } as const
const MONTH = { month: 'long', year: 'numeric' } as const
const MONTH_SHORT = { month: 'short' } as const
const TIME = { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' } as const

const pad = (n: number) => String(n).padStart(2, '0')

/** A `yyyy-mm-dd` day as local midnight, for the calendar. */
function toLocal(day: string): Date | undefined {
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? new Date(`${day}T00:00:00`) : undefined
}

function toDay(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Noon UTC on that wall date, so the store-zone label never slips a day. */
function labelDate(value: string): Date {
  return new Date(`${value.length === 7 ? `${value}-01` : value.slice(0, 10)}T12:00:00Z`)
}

/** The wall time of a datetime value, 09:00 until one is picked. */
function timeOf(value: string): string {
  return value.slice(11, 16) || '09:00'
}

function yearOf(value: string): number {
  return Number((value || toDay(new Date())).slice(0, 4))
}

/**
 * The one date picker in the admin (audit #33/#71/#83): an input-styled button that opens a
 * calendar (date; datetime adds a time box) or a month grid (month). Replaces the browser's
 * native date, month and datetime inputs.
 */
export default function DateField({
  value,
  onChange,
  mode = 'date',
  id,
  min,
  max,
  placeholder,
  disabled = false,
  clearable = false,
  invalid = false,
  className,
  'aria-label': ariaLabel,
  'aria-invalid': ariaInvalid,
}: DateFieldProps) {
  // Hooks
  const copy = useCopy(dateFieldContent)
  const fmt = useFormat()
  const [open, setOpen] = useState(false)
  const [year, setYear] = useState(() => yearOf(value))

  // Helpers
  const monthValue = (m: number) => `${year}-${pad(m + 1)}`
  const monthOff = (m: number) =>
    (min ? monthValue(m) < min.slice(0, 7) : false) ||
    (max ? monthValue(m) > max.slice(0, 7) : false)

  // Event handlers
  const handleOpenChange = (next: boolean) => {
    if (next) setYear(yearOf(value))
    setOpen(next)
  }

  const handleDay = (picked: Date | undefined) => {
    if (!picked) return
    const next = toDay(picked)
    onChange(mode === 'datetime' ? `${next}T${timeOf(value)}` : next)
    if (mode === 'date') setOpen(false)
  }

  const handleTime = (next: string) => {
    if (!/^\d{2}:\d{2}$/.test(next)) return
    onChange(`${value.slice(0, 10) || toDay(new Date())}T${next}`)
  }

  const handleMonth = (m: number) => {
    onChange(monthValue(m))
    setOpen(false)
  }

  const handleClear = () => {
    onChange('')
    setOpen(false)
  }

  // Render logic
  const day = value.slice(0, 10)
  const time = mode === 'datetime' ? timeOf(value) : ''
  const timeLabel = time ? fmt.pattern(new Date(`1970-01-01T${time}:00Z`), TIME) : ''
  const label = !value
    ? (placeholder ?? (mode === 'month' ? copy.pickMonth : copy.pick))
    : mode === 'month'
      ? fmt.pattern(labelDate(value), MONTH)
      : mode === 'datetime'
        ? `${fmt.pattern(labelDate(value), DAY)}, ${timeLabel}`
        : fmt.pattern(labelDate(value), DAY)
  const minDay = toLocal((min ?? '').slice(0, 10))
  const maxDay = toLocal((max ?? '').slice(0, 10))
  const disabledDays = [
    ...(minDay ? [{ before: minDay }] : []),
    ...(maxDay ? [{ after: maxDay }] : []),
  ]
  const timeId = id ? `${id}-time` : undefined

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        id={id}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-invalid={invalid || ariaInvalid || undefined}
        className={cn(TRIGGER, className)}
      >
        <Clock className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className={cn('min-w-0 flex-1 truncate', !value && 'text-muted-foreground')}>
          {label}
        </span>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-2">
        {mode === 'month' ? (
          <div className="flex w-64 flex-col gap-2">
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={copy.previousYear}
                onClick={() => setYear((y) => y - 1)}
              >
                <ChevronLeftIcon aria-hidden="true" />
              </Button>
              <span className="text-body-strong tabular-nums">{year}</span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={copy.nextYear}
                onClick={() => setYear((y) => y + 1)}
              >
                <ChevronRight aria-hidden="true" />
              </Button>
            </div>
            <div className="grid grid-cols-3 gap-1">
              {Array.from({ length: 12 }, (_, m) => (
                <Button
                  key={monthValue(m)}
                  variant={value === monthValue(m) ? 'default' : 'ghost'}
                  size="sm"
                  disabled={monthOff(m)}
                  onClick={() => handleMonth(m)}
                >
                  {fmt.pattern(labelDate(monthValue(m)), MONTH_SHORT)}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <Calendar
            mode="single"
            selected={toLocal(day)}
            defaultMonth={toLocal(day) ?? minDay}
            onSelect={handleDay}
            disabled={disabledDays}
            captionLayout="dropdown"
          />
        )}
        {mode === 'datetime' ? (
          <div className="flex items-center gap-2 border-border border-t px-1 pt-2">
            <label htmlFor={timeId} className="text-caption text-muted-foreground">
              {copy.time}
            </label>
            <Input
              id={timeId}
              size="kit"
              type="time"
              value={time}
              onChange={(e) => handleTime(e.target.value)}
              className="w-32"
            />
          </div>
        ) : null}
        {clearable && value ? (
          <div className="flex justify-end px-1 pt-2">
            <Button variant="ghost" size="sm" onClick={handleClear}>
              {copy.clear}
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  )
}
