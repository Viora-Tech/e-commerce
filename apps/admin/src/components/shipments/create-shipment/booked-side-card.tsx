'use client'

import { CalendarIcon } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import DataCard from '@/components/layout/data-card'
import { createShipmentContent } from '@/data/create-shipment'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import BookedDrawer from './booked-drawer'
import DoneStep, { type BookedShipment } from './done-step'
import PickupNowDialog from './pickup-now-dialog'

type BookedSideCardProps = {
  booked: BookedShipment
  /** The courier wallet that paid, when it reports a live balance: read again for the drawer. */
  liveWalletProvider: string | null
  onChange: (booked: BookedShipment) => void
  /** After a pickup was booked (the page reads the shipment again). */
  onPickup: () => void
}

/**
 * Create shipment once booked: the summary's place holds the "booked" note and Schedule pickup,
 * and the Booked drawer (Figma 905:7783) opens over the page as this mounts. Create pickup now
 * swaps it for the Create pickup drawer (Figma 905:8280).
 */
export default function BookedSideCard({
  booked,
  liveWalletProvider,
  onChange,
  onPickup,
}: BookedSideCardProps) {
  // Hooks
  const content = useCopy(createShipmentContent)
  const fmt = useFormat()
  const [bookedOpen, setBookedOpen] = useState(true)
  const [pickupOpen, setPickupOpen] = useState(false)
  const [walletLeft, setWalletLeft] = useState<number | null>(null)
  useEffect(() => {
    if (!liveWalletProvider) return
    let live = true
    api.shipments
      .refreshWallet({ providerId: liveWalletProvider })
      .then((w) => live && setWalletLeft(w.balancePaise))
      .catch(() => undefined)
    return () => {
      live = false
    }
  }, [liveWalletProvider])

  // Event handlers
  const handleCreatePickup = () => {
    setBookedOpen(false)
    setPickupOpen(true)
  }
  const handlePickupDone = (date: string) => {
    onChange({ ...booked, pickupRequested: true })
    toast.success(
      content.booked.pickupBooked(
        fmt.pattern(date, { weekday: 'short', day: 'numeric', month: 'short' }),
      ),
    )
    onPickup()
  }

  // Render logic
  const shown: BookedShipment =
    booked.facts && walletLeft !== null
      ? { ...booked, facts: { ...booked.facts, walletLeftPaise: walletLeft } }
      : booked

  return (
    <DataCard title={booked.manual ? content.done.manualHeading : content.done.heading}>
      <DoneStep booked={booked} summaryOnly />
      {booked.shipmentId && !booked.manual ? (
        <>
          {booked.canPickup && !booked.pickupRequested ? (
            <Button variant="outline" className="mt-3 w-full" onClick={() => setPickupOpen(true)}>
              <CalendarIcon aria-hidden="true" />
              {content.drawer.pickupNow}
            </Button>
          ) : null}
          <BookedDrawer
            open={bookedOpen}
            onOpenChange={setBookedOpen}
            booked={shown}
            onCreatePickup={handleCreatePickup}
            backHref={routes.orders.list()}
          />
          <PickupNowDialog
            open={pickupOpen}
            onOpenChange={setPickupOpen}
            shipmentIds={[booked.shipmentId]}
            onDone={handlePickupDone}
          />
        </>
      ) : null}
    </DataCard>
  )
}
