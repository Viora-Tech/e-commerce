'use client'

import { XIcon } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@commerce/ui/shadcn/drawer'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { createShipmentContent } from '@/data/create-shipment'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import PickupDayCards from './pickup-day-cards'
import PickupParcelList, { type PickupGroup } from './pickup-parcel-list'
import { PICKUP_TIMES, pickupDays, startingPickupDay } from './pickup-plan'
import PickupSelect from './pickup-select'

type PickupDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The booked parcels the pickup is for; the courier's other booked parcels can be ticked too. */
  shipmentIds: string[]
  /** After the last pickup location's pickup was booked or joined, with its day. */
  onDone: (date: string) => void
}

const NO_END = 'none'
const DEFAULT_FROM = '14:00'

/** The pickup a group already has on `date`, if any (joining it asks the courier nothing new). */
const pickupOn = (group: PickupGroup | undefined, date: string) =>
  group?.pickups.find((p) => p.scheduledFor === date) ?? null

/**
 * Create pickup (Figma 905:8280): a bottom drawer with the pickup location, day and time on the
 * left and the parcels it collects on the right. When the courier is already coming that day the
 * banner says so, the time is the pickup's own and the button adds the parcels to it (Figma
 * 906:8464). Parcels from several couriers or places get one pickup each, one place at a time.
 */
export default function PickupDrawer({
  open,
  onOpenChange,
  shipmentIds,
  onDone,
}: PickupDrawerProps) {
  // Hooks
  const copy = useCopy(createShipmentContent.pickupDrawer)
  const fmt = useFormat()
  const [groups, setGroups] = useState<PickupGroup[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [groupKey, setGroupKey] = useState('')
  const [picked, setPicked] = useState<string[]>([])
  const [date, setDate] = useState('')
  const [timeFrom, setTimeFrom] = useState(DEFAULT_FROM)
  const [timeTo, setTimeTo] = useState('')
  const [busy, setBusy] = useState(false)
  // Loaded each time the drawer opens, so parcels booked meanwhile show up.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the ids' text stands for the array, which callers rebuild each render
  useEffect(() => {
    if (!open || shipmentIds.length === 0) return
    let live = true
    setGroups(null)
    setFailed(false)
    api.shipments
      .listPickupOptions({ shipmentIds })
      .then((r) => {
        if (!live) return
        setGroups(r.groups)
        const first = r.groups[0]
        if (first) startOn(first)
      })
      .catch(() => live && setFailed(true))
    return () => {
      live = false
    }
  }, [open, shipmentIds.join(',')])

  // Helpers
  const startOn = (group: PickupGroup) => {
    setGroupKey(group.key)
    setPicked(group.parcels.filter((p) => p.anchor).map((p) => p.shipmentId))
    setDate(startingPickupDay(pickupDays(), (d) => pickupOn(group, d) !== null))
    setTimeFrom(DEFAULT_FROM)
    setTimeTo('')
  }

  // Event handlers
  const handleGroup = (key: string) => {
    const next = groups?.find((g) => g.key === key)
    if (next) startOn(next)
  }
  const handleToggle = (shipmentId: string, on: boolean) =>
    setPicked((ids) => (on ? [...ids, shipmentId] : ids.filter((id) => id !== shipmentId)))
  const handleSubmit = async () => {
    if (!group || picked.length === 0) return
    setBusy(true)
    try {
      const pickups = await api.shipments.schedulePickup({
        shipmentIds: picked,
        date,
        timeFrom: existing?.timeFrom ?? timeFrom,
        timeTo: existing ? undefined : timeTo || undefined,
        joinPickupId: existing?.id,
      })
      // A refusal is recorded, not thrown: read it so "booked" is never said falsely.
      const refused = pickups.find((p) => p.status === 'failed')
      if (refused) {
        toast.error(refused.error || copy.refused)
        return
      }
      for (const p of pickups) {
        await api.shipments.createManifest({ pickupId: p.id }).catch(() => undefined)
      }
      toast.success(existing ? copy.joined(picked.length) : copy.created)
      /* Parcels from another courier or place need their own pickup: go on with the next. */
      const rest = (groups ?? []).filter(
        (g) => g.key !== group.key && g.parcels.some((p) => p.anchor),
      )
      setGroups(rest)
      const next = rest[0]
      if (next) {
        startOn(next)
        toast.info(copy.nextPlace)
        return
      }
      onOpenChange(false)
      onDone(date)
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : copy.refused)
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  const group = groups?.find((g) => g.key === groupKey) ?? groups?.[0]
  const days = pickupDays()
  const existing = pickupOn(group, date)
  const courier = group?.providerLabel ?? ''
  const several = new Set(groups?.map((g) => g.providerId)).size > 1
  const placeOptions = (groups ?? []).map((g) => {
    const label = copy.placeLabel(g.place, g.city, g.pincode)
    return { value: g.key, label: several ? copy.placeWithCourier(label, g.providerLabel) : label }
  })
  const fromOptions = PICKUP_TIMES.map((t) => ({ value: t, label: copy.fromValue(t) }))
  const toOptions = [
    { value: NO_END, label: copy.noEnd },
    ...PICKUP_TIMES.filter((t) => t > timeFrom).map((t) => ({ value: t, label: copy.toValue(t) })),
  ]
  const shownFrom = existing?.timeFrom ?? timeFrom
  const ready = Boolean(group) && picked.length > 0 && date !== '' && !busy
  const body = failed ? (
    <p className="py-6 text-body text-muted-foreground">{copy.failed}</p>
  ) : !groups ? (
    <p className="flex items-center gap-2 py-6 text-body text-muted-foreground">
      <Spinner />
      {copy.loading}
    </p>
  ) : !group ? (
    <p className="py-6 text-body text-muted-foreground">{copy.nothing}</p>
  ) : (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_26rem]">
      <section className="flex flex-col gap-5 rounded-xl border border-hairline p-5">
        {existing ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-muted px-4 py-3">
            <div className="flex min-w-0 flex-col gap-0.5">
              <p className="text-body font-medium text-ink-strong">
                {copy.alreadyComing(
                  courier,
                  fmt.pattern(existing.scheduledFor, {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                  }),
                  existing.timeFrom,
                )}
              </p>
              <p className="text-caption text-muted-foreground">
                {copy.alreadyDetail(existing.providerRef, existing.parcelCount, group.place)}
              </p>
            </div>
            <Button
              variant="ghost"
              render={<Link href={routes.orders.shipmentPickups()} />}
              nativeButton={false}
            >
              {copy.viewPickup}
            </Button>
          </div>
        ) : null}
        <PickupSelect
          id="pickup-place"
          label={copy.location}
          value={group.key}
          options={placeOptions}
          onChange={handleGroup}
          disabled={placeOptions.length < 2}
          help={copy.registered(courier)}
        />
        <PickupDayCards
          days={days}
          value={date}
          onChange={setDate}
          bookedAt={(d) => pickupOn(group, d)?.timeFrom ?? null}
        />
        <fieldset className="flex flex-col gap-2 border-0 p-0">
          <legend className="mb-2 text-body font-medium text-ink-strong">{copy.time}</legend>
          <div className="grid gap-3 sm:grid-cols-2">
            <PickupSelect
              id="pickup-from"
              label={copy.from}
              hideLabel
              value={shownFrom}
              options={fromOptions}
              onChange={(v) => {
                setTimeFrom(v)
                if (timeTo && timeTo <= v) setTimeTo('')
              }}
              disabled={existing !== null}
            />
            <PickupSelect
              id="pickup-to"
              label={copy.to}
              hideLabel
              value={existing ? '' : timeTo || ''}
              placeholder={copy.to}
              options={toOptions}
              onChange={(v) => setTimeTo(v === NO_END ? '' : v)}
              disabled={existing !== null}
            />
          </div>
          <p className="text-caption text-muted-foreground">
            {existing ? copy.timeLocked : copy.timeHelp}
          </p>
        </fieldset>
      </section>
      <section className="flex flex-col justify-between gap-5 rounded-xl border border-hairline p-5">
        <PickupParcelList
          group={group}
          picked={picked}
          onToggle={handleToggle}
          alreadyIn={existing ? existing.orderNumbers : null}
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => void handleSubmit()} disabled={!ready} loading={busy}>
            {existing ? copy.add(picked.length) : copy.create(picked.length)}
          </Button>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {copy.later}
          </Button>
        </div>
      </section>
    </div>
  )

  return (
    <Drawer open={open} onOpenChange={onOpenChange} showSwipeHandle>
      <DrawerContent className="mx-auto max-h-[calc(100dvh-4rem)] max-w-[90rem]">
        <DrawerHeader className="flex flex-row items-start justify-between gap-4 px-4 pt-2 text-left md:px-8">
          <div className="flex min-w-0 flex-col items-start gap-1 text-left">
            <DrawerTitle className="text-lg font-semibold text-ink-strong">
              {copy.title}
            </DrawerTitle>
            <DrawerDescription className="text-body text-muted-foreground">
              {group ? (existing ? copy.subtitleJoin(courier) : copy.subtitle(courier)) : null}
            </DrawerDescription>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={copy.close}
            onClick={() => onOpenChange(false)}
          >
            <XIcon aria-hidden="true" />
          </Button>
        </DrawerHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6 md:px-8">{body}</div>
      </DrawerContent>
    </Drawer>
  )
}
