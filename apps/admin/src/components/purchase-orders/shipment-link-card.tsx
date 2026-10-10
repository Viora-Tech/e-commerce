'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@commerce/ui/shadcn/card'
import Link from 'next/link'
import { poShipmentContent } from '@/data/purchasing'
import { useCopy } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'

type ShipmentLinkCardProps = {
  shipment: { id: string; number: number; reference: string | null } | null
}

/** The inbound shipment this order came in on, whose charges it shares. */
export default function ShipmentLinkCard({ shipment }: ShipmentLinkCardProps) {
  // Hooks
  const copy = useCopy(poShipmentContent)

  // Render logic
  return (
    <Card size="form">
      <CardHeader>
        <CardTitle>{copy.heading}</CardTitle>
      </CardHeader>
      <CardContent className="text-body">
        {shipment ? (
          <Link
            href={routes.products.inboundShipment(shipment.id)}
            className="text-body-strong hover:underline"
          >
            {copy.on(shipment.number, shipment.reference)}
          </Link>
        ) : (
          <p className="text-muted-foreground">{copy.none}</p>
        )}
      </CardContent>
    </Card>
  )
}
