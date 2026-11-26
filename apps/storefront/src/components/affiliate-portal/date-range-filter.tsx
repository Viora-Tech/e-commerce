'use client'

import { CalendarIcon, ChevronDown } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Calendar } from '@commerce/ui/shadcn/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@commerce/ui/shadcn/popover'
import { useState } from 'react'
import { affiliatePortalContent } from '@/data/affiliate-portal'

type Range = { from?: string | undefined; to?: string | undefined }

type DateRangeFilterProps = {
  /** The applied days as `YYYY-MM-DD` (from the URL). */
  value: Range
  onApply: (range: Range) => void
}

type Picked = { from?: Date | undefined; to?: Date | undefined } | undefined

const copy = affiliatePortalContent.commissions.filters

const SHORT: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }

/** A `YYYY-MM-DD` day as a local midnight Date for the calendar, and back. */
function toDate(iso: string | undefined): Date | undefined {
  return iso ? new Date(`${iso}T00:00:00`) : undefined
}

function toIso(d: Date | undefined): string | undefined {
  if (!d) return undefined
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** The month before `d`, so two months show the picked range's end on the right. */
function monthBefore(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() - 1, 1)
}

/**
 * shadcn's date range picker (Popover + Calendar in range mode, as the admin's): an outline
 * button with the picked days ("1 Nov – 26 Nov") or "Any date", two months on a wide screen and
 * one on a phone, and Apply. Nothing changes until Apply.
 */
export default function DateRangeFilter({ value, onApply }: DateRangeFilterProps) {
  // Hooks
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Picked>(undefined)

  // Event handlers
  const handleOpenChange = (next: boolean) => {
    if (next) setDraft({ from: toDate(value.from), to: toDate(value.to) })
    setOpen(next)
  }
  const handleApply = () => {
    const from = toIso(draft?.from)
    onApply({ from, to: toIso(draft?.to) ?? from })
    setOpen(false)
  }

  // Render logic
  const from = toDate(value.from)
  const to = toDate(value.to)
  const label = from
    ? `${from.toLocaleDateString('en-IN', SHORT)} – ${(to ?? from).toLocaleDateString('en-IN', SHORT)}`
    : copy.anyDate
  const today = new Date()
  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        aria-label={copy.dates}
        render={<Button variant="outline" size="sm" className="font-normal" />}
      >
        <CalendarIcon />
        {label}
        <ChevronDown className="text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto max-w-[calc(100vw-2rem)] gap-0 p-0">
        <Calendar
          mode="range"
          numberOfMonths={2}
          className="hidden sm:block"
          defaultMonth={monthBefore(draft?.to ?? draft?.from ?? today)}
          selected={draft?.from ? { from: draft.from, to: draft.to } : undefined}
          onSelect={setDraft}
          disabled={{ after: today }}
        />
        <Calendar
          mode="range"
          className="sm:hidden"
          defaultMonth={draft?.to ?? draft?.from ?? today}
          selected={draft?.from ? { from: draft.from, to: draft.to } : undefined}
          onSelect={setDraft}
          disabled={{ after: today }}
        />
        <div className="flex items-center justify-end gap-2 border-t p-2">
          <Button variant="ghost" size="sm" onClick={() => setDraft(undefined)}>
            {copy.reset}
          </Button>
          <Button size="sm" onClick={handleApply}>
            {copy.apply}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
