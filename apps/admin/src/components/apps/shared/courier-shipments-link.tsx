/**
 * SOURCE OF TRUTH KEYWORDS: CourierShipmentsLink
 * WHAT:  a connected courier's next step on its Overview: a line of help and a button into Orders → Shipments.
 * WHY:   one owner instead of the same block in each courier Overview; couriers share one Shipments workspace.
 * WHERE: the courier Overview wrappers, as ProviderOverviewPage's connectedBody.
 */
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'

type CourierShipmentsLinkProps = { help: string; cta: string }

export default function CourierShipmentsLink({ help, cta }: CourierShipmentsLinkProps) {
  return (
    <>
      <p className="text-body text-muted-foreground">{help}</p>
      <Button className="w-fit" render={<Link href="/orders/shipments" />} nativeButton={false}>
        {cta}
      </Button>
    </>
  )
}
