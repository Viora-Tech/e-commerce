'use client'

import { RefreshCw } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import AppStoreLink from '@/components/apps/app-store-link'
import { createShipmentContent } from '@/data/create-shipment'
import { useCopy } from '@/hooks/use-copy'

type CourierDrawerStatusProps = {
  /** The couriers answered for this package. */
  quoted: boolean
  noCourier: boolean
  needsPackage: boolean
  failed: boolean
  updating: boolean
  waitingForSize: boolean
  onRetry: () => void
}

/** What the Select courier drawer says above its table: asking, failed, no courier connected,
 *  a weight still missing, or prices updating for a changed package. */
export default function CourierDrawerStatus({
  quoted,
  noCourier,
  needsPackage,
  failed,
  updating,
  waitingForSize,
  onRetry,
}: CourierDrawerStatusProps) {
  // Hooks
  const content = useCopy(createShipmentContent)

  // Early returns
  if (quoted && !updating && !waitingForSize) return null

  return !quoted ? (
    noCourier ? (
      <div className="flex flex-col items-start gap-3 py-6">
        <p className="text-body text-muted-foreground">{content.courier.noCourier}</p>
        <AppStoreLink category="shipping" className="w-fit">
          {content.courier.connect}
        </AppStoreLink>
      </div>
    ) : needsPackage ? (
      <p className="py-6 text-body text-muted-foreground">{content.courier.needsWeight}</p>
    ) : failed ? (
      <p className="flex items-center gap-3 py-6 text-body text-muted-foreground">
        {content.courier.quoteFailed}
        <Button size="sm" variant="outline" onClick={onRetry}>
          <RefreshCw aria-hidden />
          {content.courier.retry}
        </Button>
      </p>
    ) : (
      <p className="flex items-center gap-2 py-6 text-body text-muted-foreground">
        <Spinner />
        {content.courier.checking}
      </p>
    )
  ) : (
    <p aria-live="polite" className="flex items-center gap-2 text-caption text-muted-foreground">
      {updating ? <Spinner className="size-3.5" /> : null}
      {updating ? content.courier.updating : content.courier.finishSize}
    </p>
  )
}
