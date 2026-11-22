'use client'

import { XIcon } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Button } from '@commerce/ui/shadcn/button'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from '@commerce/ui/shadcn/drawer'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import EmptyState from '@/components/layout/empty-state'
import InlineState from '@/components/states/inline-state'
import { createShipmentContent } from '@/data/create-shipment'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { errorText } from '@/lib/api-errors'
import { routes } from '@/lib/routes'
import { BESIDE_SIDEBAR } from '@/lib/sidebar-motion'
import PickupDayCards from './pickup-day-cards'
import PickupDrawerSkeleton from './pickup-drawer-skeleton'
import PickupParcelList, { type PickupGroup } from './pickup-parcel-list'
import { PICKUP_TIMES, pickupDays, startingPickupDay } from './pickup-plan'
import PickupSelect from './pickup-select'

type PickupDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The parcels just booked; only these go on the pickup (other booked parcels: Shipments → Booked). */
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
 * left and the parcel just booked on the right (only that one: other booked parcels are sent from
 * Shipments → Booked). When the courier is already coming that day the banner says so, the time
 * is the pickup's own and the button adds the parcel to it (Figma 906:8464). A split order's
 * parcels with several couriers or places get one pickup each, one place at a time. Later leaves
 * the parcel in Booked.
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
  const [date, setDate] = useState('')
  const [timeFrom, setTimeFrom] = useState(DEFAULT_FROM)
  const [timeTo, setTimeTo] = useState('')
  const [busy, setBusy] = useState(false)
  /** Bumped by Try again when the pickup details did not load. */
  const [attempt, setAttempt] = useState(0)
  // Loaded each time the drawer opens, so parcels booked meanwhile show up.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the ids' text stands for the array, which callers rebuild each render
  useEffect(() => {
    if (!open || shipmentIds.length === 0 || attempt < 0) return
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
  }, [open, shipmentIds.join(','), attempt])

  // Helpers
  const startOn = (group: PickupGroup) => {
    setGroupKey(group.key)
    setDate(startingPickupDay(pickupDays(), (d) => pickupOn(group, d) !== null))
    setTimeFrom(DEFAULT_FROM)
    setTimeTo('')
  }

  // Event handlers
  /* Swipe, Esc, a click outside and the X wait while the pickup is being booked (audit 9c). */
  const handleOpenChange = (next: boolean) => {
    if (!next && busy) return
    onOpenChange(next)
  }
  const handleRetry = () => setAttempt((n) => n + 1)
  const handleGroup = (key: string) => {
    const next = groups?.find((g) => g.key === key)
    if (next) startOn(next)
  }
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
      toast.error(errorText(err, copy.refused))
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  const group = groups?.find((g) => g.key === groupKey) ?? groups?.[0]
  const days = pickupDays()
  const existing = pickupOn(group, date)
  // Only the parcels the drawer was opened for (the server also lists the courier's others).
  const picked = group?.parcels.filter((p) => p.anchor).map((p) => p.shipmentId) ?? []
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
    <InlineState kind="error" heading={copy.failed} onRetry={handleRetry} />
  ) : !groups ? (
    <PickupDrawerSkeleton label={copy.loading} />
  ) : !group ? (
    <EmptyState variant="inline" body={copy.nothing} />
  ) : (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_26rem]">
      <section className="flex flex-col gap-5 rounded-lg border border-hairline p-5">
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
      <section className="flex flex-col justify-between gap-5 rounded-lg border border-hairline p-5">
        <PickupParcelList group={group} />
        {/* The dialog footer order (audit 3.4): the dismiss button, then the one primary. */}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            {copy.later}
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={!ready} loading={busy}>
            {existing ? copy.add(picked.length) : copy.create(picked.length)}
          </Button>
        </div>
      </section>
    </div>
  )

  return (
    <Drawer open={open} onOpenChange={handleOpenChange} showSwipeHandle>
      <DrawerContent
        className={cn('mx-auto max-h-[calc(100dvh-4rem)] max-w-[90rem]', BESIDE_SIDEBAR)}
      >
        <DrawerHeader className="flex flex-row items-start justify-between gap-4 px-4 pt-2 text-left">
          <div className="flex min-w-0 flex-col items-start gap-1 text-left">
            <DrawerTitle>{copy.title}</DrawerTitle>
            <DrawerDescription className="text-body text-muted-foreground">
              {group ? (existing ? copy.subtitleJoin(courier) : copy.subtitle(courier)) : null}
            </DrawerDescription>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={copy.close}
            onClick={() => handleOpenChange(false)}
            disabled={busy}
          >
            <XIcon aria-hidden="true" />
          </Button>
        </DrawerHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-6">{body}</div>
      </DrawerContent>
    </Drawer>
  )
}
