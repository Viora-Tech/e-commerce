'use client'

import { cn } from '@commerce/ui/lib/utils'
import { createShipmentContent } from '@/data/create-shipment'
import { useCopy, useFormat } from '@/hooks/use-copy'
import type { PickupDay } from './pickup-plan'

type PickupDayCardsProps = {
  days: PickupDay[]
  value: string
  onChange: (date: string) => void
  /** The start time of a pickup already booked that day, for its "Pickup booked · 14:00" tag. */
  bookedAt: (date: string) => string | null
}

/**
 * Figma 905:8280 "Pickup day": today, tomorrow and the next day as cards. Today greys out after
 * the courier's 2 pm cut-off, unless a pickup is already booked for it (joining stays fine); a
 * day with a booked pickup carries its tag (Figma 906:8464).
 */
export default function PickupDayCards({ days, value, onChange, bookedAt }: PickupDayCardsProps) {
  // Hooks
  const copy = useCopy(createShipmentContent.pickupDrawer)
  const fmt = useFormat()

  // Render logic
  const cards = days.map((d) => {
    const booked = bookedAt(d.date)
    return {
      ...d,
      booked,
      closed: d.pastCutoff && booked === null,
      title:
        d.offset === 0
          ? copy.today
          : d.offset === 1
            ? copy.tomorrow
            : fmt.pattern(d.date, { weekday: 'long' }),
      detail:
        d.offset === 0
          ? `${fmt.pattern(d.date, { weekday: 'short', day: 'numeric', month: 'short' })} · ${
              d.pastCutoff ? copy.afterCutoff : copy.beforeCutoff
            }`
          : d.offset === 1
            ? fmt.pattern(d.date, { weekday: 'short', day: 'numeric', month: 'short' })
            : fmt.pattern(d.date, { day: 'numeric', month: 'short' }),
    }
  })

  return (
    <fieldset className="grid gap-3 border-0 p-0 sm:grid-cols-3">
      <legend className="mb-2 text-body font-medium text-ink-strong">{copy.day}</legend>
      {cards.map((c) => (
        <button
          key={c.date}
          type="button"
          aria-pressed={value === c.date}
          disabled={c.closed}
          onClick={() => onChange(c.date)}
          className={cn(
            'motion-press flex min-h-[4.75rem] flex-col items-start gap-0.5 rounded-lg border bg-card px-3.5 py-3 text-left text-body outline-none focus-visible:ring-3 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:opacity-50',
            value === c.date
              ? 'border-foreground ring-1 ring-foreground'
              : 'border-input hover:border-border-strong',
          )}
        >
          <span className="font-medium text-ink-strong">{c.title}</span>
          <span className="text-caption text-muted-foreground">{c.detail}</span>
          {c.booked ? (
            <span className="mt-1 rounded-md border border-info/40 bg-info-soft px-1.5 py-0.5 text-caption font-medium text-info">
              {copy.bookedTag(c.booked)}
            </span>
          ) : null}
        </button>
      ))}
    </fieldset>
  )
}
