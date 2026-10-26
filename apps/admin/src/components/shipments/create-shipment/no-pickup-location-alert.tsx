'use client'

import { ExternalLink, TriangleAlert } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import CopyButton from '@/components/fields/copy-button'
import { shipmentDetailsContent } from '@/data/shipping'
import { useCopy } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'

type NoPickupLocationAlertProps = {
  /** The pickup location name the booking sent, exactly. */
  name: string
}

/** Delhivery One, where the merchant's pickup locations are listed (Settings → Pickup locations). */
const DELHIVERY_ONE = 'https://one.delhivery.com/'
const DELHIVERY_HELP = 'https://help.delhivery.com/docs/pickup-locations'

/** Pull the pickup location name out of a booking error from `orders.createShipment`. */
export function missingPickupLocation(err: unknown): string | null {
  const data = (err as { data?: { code?: unknown; pickupLocationName?: unknown } } | null)?.data
  return data?.code === 'no_pickup_location' && typeof data.pickupLocationName === 'string'
    ? data.pickupLocationName
    : null
}

/**
 * Delhivery turned the booking down because it has no pickup location by the name we sent. The
 * Connect page's "Test connection" cannot catch this (Delhivery has no read-only way to look a
 * pickup location up), so the booking says it plainly: the exact name sent, and where to fix it.
 */
export default function NoPickupLocationAlert({ name }: NoPickupLocationAlertProps) {
  // Hooks
  const copy = useCopy(shipmentDetailsContent.noPickupLocation)

  return (
    <div
      role="alert"
      className="flex flex-col gap-3 rounded-lg border border-danger-border bg-danger-soft p-4"
    >
      <p className="flex items-center gap-2 font-medium text-ink-strong">
        <TriangleAlert aria-hidden="true" className="size-4 shrink-0 text-danger" />
        {copy.title}
      </p>
      <p className="text-body text-muted-foreground">{copy.body}</p>
      <p className="flex items-center gap-1.5">
        <code className="break-all rounded-md bg-background px-2 py-1 text-ink-strong">{name}</code>
        <CopyButton value={name} what={copy.name} visible />
      </p>
      <p className="text-body text-muted-foreground">{copy.fix}</p>
      <div className="flex flex-wrap justify-end gap-2">
        <Button
          variant="outline"
          render={<a href={DELHIVERY_HELP} target="_blank" rel="noreferrer" />}
          nativeButton={false}
        >
          {copy.help}
        </Button>
        <Button
          variant="outline"
          render={<Link href={routes.apps.connect('delhivery')} />}
          nativeButton={false}
        >
          {copy.connect}
        </Button>
        <Button
          render={<a href={DELHIVERY_ONE} target="_blank" rel="noreferrer" />}
          nativeButton={false}
        >
          <ExternalLink aria-hidden="true" />
          {copy.openDelhivery}
        </Button>
      </div>
    </div>
  )
}
