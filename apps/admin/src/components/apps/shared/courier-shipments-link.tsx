/**
 * SOURCE OF TRUTH KEYWORDS: CourierShipmentsLink
 * WHAT:  a connected courier's next step on its Overview: a line of help and a button into Orders → Shipments.
 * WHY:   one owner instead of the same block in each courier Overview; couriers share one Shipments workspace.
 * WHERE: the courier Overview wrappers, as ProviderOverviewPage's connectedBody.
 */
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { routes } from '@/lib/routes'

type CourierShipmentsLinkProps = {
  help: string
  cta: string
  /** The courier's id: the button opens Shipments filtered to its parcels. */
  courier?: string | undefined
}

export default function CourierShipmentsLink({ help, cta, courier }: CourierShipmentsLinkProps) {
  // Render logic
  const href = courier ? routes.orders.courierShipments(courier) : routes.orders.shipments()

  return (
    <>
      <p className="text-body text-muted-foreground">{help}</p>
      <Button className="w-fit" render={<Link href={href} />} nativeButton={false}>
        {cta}
      </Button>
    </>
  )
}
