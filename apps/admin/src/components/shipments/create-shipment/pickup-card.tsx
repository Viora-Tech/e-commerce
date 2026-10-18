'use client'

import { Field, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { Switch } from '@commerce/ui/shadcn/switch'
import ChoiceCard from '@/components/layout/choice-card'
import DataCard from '@/components/layout/data-card'
import { createShipmentContent } from '@/data/create-shipment'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { PICKUP_DAYS, type PickupPlan, pickupDayKey } from './pickup-plan'

type PickupCardProps = {
  plan: PickupPlan
  onChange: (plan: PickupPlan) => void
  /** The picked courier takes pickup requests. */
  canPickup: boolean
}

/** Figma "Pickup and updates": whether to ask the courier to collect, which day and from when.
 *  The request goes out right after the booking. The WhatsApp update row is left out: no
 *  shipping-update setting exists to switch. */
export default function PickupCard({ plan, onChange, canPickup }: PickupCardProps) {
  // Hooks
  const copy = useCopy(createShipmentContent.pickup)
  const fmt = useFormat()

  // Helpers
  const set = (patch: Partial<PickupPlan>) => onChange({ ...plan, ...patch })

  // Render logic
  const on = plan.ask && canPickup
  const days = Array.from({ length: PICKUP_DAYS }, (_, offset) => {
    const date = pickupDayKey(offset)
    return {
      date,
      title:
        offset === 0
          ? copy.today
          : offset === 1
            ? copy.tomorrow
            : fmt.pattern(date, { weekday: 'long' }),
      detail:
        offset === 0
          ? `${fmt.pattern(date, { day: 'numeric', month: 'short' })} · ${copy.cutoff}`
          : fmt.pattern(date, { weekday: 'short', day: 'numeric', month: 'short' }),
    }
  })

  return (
    <DataCard title={copy.cardTitle}>
      <div className="flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <p className="text-body font-medium text-ink-strong">{copy.heading}</p>
            <p className="text-caption text-muted-foreground">
              {canPickup ? copy.help : copy.unavailable}
            </p>
          </div>
          <Switch
            checked={on}
            disabled={!canPickup}
            onCheckedChange={(ask) => set({ ask })}
            aria-label={copy.heading}
          />
        </div>
        {on ? (
          <>
            <fieldset className="grid gap-3 border-0 p-0 sm:grid-cols-3">
              <legend className="sr-only">{copy.dayLabel}</legend>
              {days.map((d) => (
                <ChoiceCard
                  key={d.date}
                  layout="row"
                  showCheck
                  label={d.title}
                  description={d.detail}
                  selected={plan.date === d.date}
                  onSelect={() => set({ date: d.date })}
                />
              ))}
            </fieldset>
            <Field className="max-w-xs">
              <FieldLabel htmlFor="pickup-card-from">{copy.from}</FieldLabel>
              <Input
                id="pickup-card-from"
                size="lg"
                value={plan.timeFrom}
                onChange={(e) => set({ timeFrom: e.target.value })}
              />
            </Field>
          </>
        ) : null}
      </div>
    </DataCard>
  )
}
