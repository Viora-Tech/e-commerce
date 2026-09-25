import { CircleAlert } from '@commerce/ui/icons'
import { Alert, AlertDescription, AlertTitle } from '@commerce/ui/shadcn/alert'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { shipmentsContent } from '@/data/shipments'

const copy = shipmentsContent.noCourier

/** Shown across the Shipments workspace when the store has no connected courier: every
 *  booking action is either disabled with a reason or replaced by this. */
export default function NoCourierBanner() {
  return (
    <Alert>
      <CircleAlert />
      <AlertTitle>{copy.heading}</AlertTitle>
      <AlertDescription>
        <p>{copy.body}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Button size="sm" render={<Link href="/apps/delhivery" />}>
            {copy.connectDelhivery}
          </Button>
          <Button size="sm" variant="outline" render={<Link href="/apps/shiprocket" />}>
            {copy.connectShiprocket}
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  )
}
