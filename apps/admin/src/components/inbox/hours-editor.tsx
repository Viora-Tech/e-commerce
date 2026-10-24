'use client'

import type { InboxDayHours } from '@commerce/core/inbox'
import { Input } from '@commerce/ui/shadcn/input'
import { Switch } from '@commerce/ui/shadcn/switch'
import { inboxContent } from '@/data/inbox'
import { useCopy } from '@/hooks/use-copy'

type HoursEditorProps = {
  hours: InboxDayHours[]
  onChange: (hours: InboxDayHours[]) => void
}

/** Monday first, the way shops in India write their week. */
const WEEK = [1, 2, 3, 4, 5, 6, 0]

const dayOf = (hours: InboxDayHours[], day: number): InboxDayHours =>
  hours.find((h) => h.day === day) ?? { day, open: false, from: '10:00', to: '19:00' }

/** One row per weekday: open or closed, and the from/to times (a late shift may run past midnight). */
export default function HoursEditor({ hours, onChange }: HoursEditorProps) {
  // Hooks
  const copy = useCopy(inboxContent)

  // Helpers
  const set = (day: number, next: Partial<InboxDayHours>) =>
    onChange(WEEK.map((d) => (d === day ? { ...dayOf(hours, d), ...next } : dayOf(hours, d))))

  // Render logic
  const a = copy.settings.availability

  return (
    <div className="flex flex-col gap-2">
      {WEEK.map((day) => {
        const h = dayOf(hours, day)
        const name = a.days[day] ?? ''
        return (
          <div key={day} className="grid grid-cols-[7rem_auto_1fr] items-center gap-3">
            <span className="text-body text-foreground">{name}</span>
            <Switch
              checked={h.open}
              aria-label={`${name}: ${h.open ? a.open : a.closed}`}
              onCheckedChange={(open) => set(day, { open })}
            />
            {h.open ? (
              <div className="flex items-center gap-2">
                <Input
                  type="time"
                  className="w-28"
                  aria-label={`${name} ${a.from}`}
                  value={h.from}
                  onChange={(e) => set(day, { from: e.target.value || h.from })}
                />
                <span className="text-caption text-muted-foreground">{a.to}</span>
                <Input
                  type="time"
                  className="w-28"
                  aria-label={`${name} ${a.to}`}
                  value={h.to}
                  onChange={(e) => set(day, { to: e.target.value || h.to })}
                />
              </div>
            ) : (
              <span className="text-caption text-muted-foreground">{a.closed}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}
