'use client'

import { Spinner } from '@commerce/ui/shadcn/spinner'
import { useEffect, useState } from 'react'
import { shipmentDetailsContent } from '@/data/shipping'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import ShipmentDetails, { type ShipmentDetailsData } from './shipment-details'

type ShipmentDetailsLoaderProps = {
  shipmentId: string
  /** After a cancel or a pickup request, for whatever lists the shipment behind. */
  onChanged?: () => void
}

/** A shipment's details by id (just booked, or opened from the Shipments list), read again
 *  after a cancel or a pickup request so the view never shows stale facts. */
export default function ShipmentDetailsLoader({
  shipmentId,
  onChanged,
}: ShipmentDetailsLoaderProps) {
  // Hooks
  const copy = useCopy(shipmentDetailsContent)
  const [shipment, setShipment] = useState<ShipmentDetailsData | null>(null)
  const [failed, setFailed] = useState(false)
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    // `revision` reads the shipment again after a change; it is never negative.
    if (revision < 0) return
    let live = true
    api.shipments
      .get({ id: shipmentId })
      .then((s) => live && setShipment(s))
      .catch(() => live && setFailed(true))
    return () => {
      live = false
    }
  }, [shipmentId, revision])

  // Event handlers
  const handleChanged = () => {
    setRevision((n) => n + 1)
    onChanged?.()
  }

  // Early returns
  if (failed && !shipment) {
    return <p className="text-body text-muted-foreground">{copy.failed}</p>
  }
  if (!shipment) {
    return (
      <p className="flex items-center gap-2 text-body text-muted-foreground">
        <Spinner />
        {copy.loading}
      </p>
    )
  }

  // Render logic
  return <ShipmentDetails shipment={shipment} onChanged={handleChanged} />
}
