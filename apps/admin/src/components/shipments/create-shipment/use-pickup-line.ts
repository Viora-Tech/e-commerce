'use client'

import { useEffect, useState } from 'react'
import { createShipmentContent } from '@/data/create-shipment'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { todayKey } from '@/lib/format-date'
import { upcomingPickups } from '../pickup-fields'

type Pickup = Awaited<ReturnType<typeof api.shipments.listPickups>>[number]

const DAY = { weekday: 'short', day: 'numeric', month: 'short' } as const

/**
 * The Create shipment summary's Pickup row (Figma 898:7376). Booking only books (owner,
 * 10 Nov 2026): the parcel joins the courier's pickup already booked for today or later, or its
 * pickup is made on Shipments › Booked. Null until a courier is picked.
 */
export function usePickupLine(providerId: string | null | undefined): string | null {
  // Hooks
  const copy = useCopy(createShipmentContent.page)
  const fmt = useFormat()
  const [pickups, setPickups] = useState<Pickup[]>([])
  useEffect(() => {
    let live = true
    api.shipments
      .listPickups()
      .then((rows) => live && setPickups(upcomingPickups(rows, todayKey())))
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [])

  // Render logic
  if (!providerId) return null
  const next = pickups.find((p) => p.provider === providerId)
  return next
    ? copy.pickupJoins(`${fmt.pattern(next.scheduledFor, DAY)}, ${next.timeFrom}`)
    : copy.pickupLater
}
