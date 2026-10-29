'use client'

import { TriangleAlert } from '@commerce/ui/icons'
import { Alert, AlertDescription, AlertTitle } from '@commerce/ui/shadcn/alert'
import { orderEditContent } from '@/data/order-edit'
import { useCopy } from '@/hooks/use-copy'

/** The warning on an order edited after it shipped: the edit leaves the shipment as it is. */
export default function EditShippedAlert() {
  // Hooks
  const copy = useCopy(orderEditContent)

  return (
    <Alert>
      <TriangleAlert aria-hidden="true" />
      <AlertTitle>{copy.shippedTitle}</AlertTitle>
      <AlertDescription>{copy.shippedBody}</AlertDescription>
    </Alert>
  )
}
