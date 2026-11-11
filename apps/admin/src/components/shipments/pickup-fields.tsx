'use client'

import { Field, FieldLabel } from '@commerce/ui/shadcn/field'
import { Input } from '@commerce/ui/shadcn/input'
import { RadioGroup, RadioGroupItem } from '@commerce/ui/shadcn/radio-group'
import { useEffect, useState } from 'react'
import DateField from '@/components/fields/date-field'
import { shipmentActionsContent } from '@/data/shipments'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { formatDate, todayKey } from '@/lib/format-date'

export type PickupValue = {
  date: string
  timeFrom: string
  timeTo: string
  /** The booked pickup picked to add the parcels to (the courier is not asked again); null for a new one. */
  joinPickupId: string | null
}

type OpenPickup = {
  id: string
  provider: string
  scheduledFor: string
  timeFrom: string
  expectedPackageCount: number
  pickupLocationName: string | null
}

type PickupFieldsProps = {
  /** Prefix for the field ids, so two dialogs on one page never clash. */
  idPrefix: string
  /** Only this courier's pickups are offered to join; omitted, every courier's are. */
  providerId?: string | undefined
  value: PickupValue
  onChange: (value: PickupValue) => void
}

const NEW = 'new'

/** Title case for a courier id ("delhivery" → "Delhivery") where no label is at hand. */
const courierName = (id: string) => id.charAt(0).toUpperCase() + id.slice(1)

/**
 * Join a pickup that is already booked (today or later), or make a new one. A courier takes one
 * pickup request per place and day, so a parcel booked after it joins it (the server matches the
 * day: `schedulePickup`). The soonest open pickup starts picked; "New pickup" shows day and time.
 */
export default function PickupFields({ idPrefix, providerId, value, onChange }: PickupFieldsProps) {
  // Hooks
  const copy = useCopy(shipmentActionsContent)
  const [open, setOpen] = useState<OpenPickup[]>([])
  const [choice, setChoice] = useState(NEW)

  // Loaded once per dialog; `onChange` is the parent's state setter, so it never needs a re-run.
  // biome-ignore lint/correctness/useExhaustiveDependencies: run once per courier when the fields mount
  useEffect(() => {
    let live = true
    const today = todayKey()
    void api.shipments
      .listPickups()
      .then((rows) => {
        if (!live) return
        const upcoming = rows
          .filter(
            (p) =>
              p.status === 'scheduled' &&
              p.scheduledFor >= today &&
              (!providerId || p.provider === providerId),
          )
          .toSorted((a, b) => a.scheduledFor.localeCompare(b.scheduledFor))
        setOpen(upcoming)
        const first = upcoming[0]
        if (first) {
          setChoice(first.id)
          onChange({
            date: first.scheduledFor,
            timeFrom: first.timeFrom,
            timeTo: '',
            joinPickupId: first.id,
          })
        }
      })
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [providerId])

  // Event handlers
  const handleChoice = (next: string) => {
    setChoice(next)
    const picked = open.find((p) => p.id === next)
    onChange(
      picked
        ? {
            date: picked.scheduledFor,
            timeFrom: picked.timeFrom,
            timeTo: '',
            joinPickupId: picked.id,
          }
        : { ...value, joinPickupId: null },
    )
  }

  // Render logic
  return (
    <div className="flex flex-col gap-3">
      {open.length > 0 ? (
        <RadioGroup value={choice} onValueChange={(v) => handleChoice(String(v))}>
          {open.map((p) => (
            <Field key={p.id} orientation="horizontal">
              <RadioGroupItem id={`${idPrefix}-join-${p.id}`} value={p.id} />
              <FieldLabel htmlFor={`${idPrefix}-join-${p.id}`} className="font-normal">
                {copy.joinPickup(
                  courierName(p.provider),
                  `${formatDate(p.scheduledFor)}, ${p.timeFrom}`,
                  p.expectedPackageCount,
                )}
              </FieldLabel>
            </Field>
          ))}
          <Field orientation="horizontal">
            <RadioGroupItem id={`${idPrefix}-new`} value={NEW} />
            <FieldLabel htmlFor={`${idPrefix}-new`} className="font-normal">
              {copy.newPickup}
            </FieldLabel>
          </Field>
        </RadioGroup>
      ) : null}
      {choice === NEW ? (
        <>
          <Field>
            <FieldLabel htmlFor={`${idPrefix}-date`}>{copy.date}</FieldLabel>
            <DateField
              id={`${idPrefix}-date`}
              value={value.date}
              onChange={(v) => onChange({ ...value, date: v, joinPickupId: null })}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field>
              <FieldLabel htmlFor={`${idPrefix}-from`}>{copy.timeFrom}</FieldLabel>
              <Input
                id={`${idPrefix}-from`}
                value={value.timeFrom}
                onChange={(e) =>
                  onChange({ ...value, timeFrom: e.target.value, joinPickupId: null })
                }
              />
            </Field>
            <Field>
              <FieldLabel htmlFor={`${idPrefix}-to`}>{copy.timeTo}</FieldLabel>
              <Input
                id={`${idPrefix}-to`}
                value={value.timeTo}
                onChange={(e) => onChange({ ...value, timeTo: e.target.value, joinPickupId: null })}
              />
            </Field>
          </div>
        </>
      ) : null}
    </div>
  )
}
