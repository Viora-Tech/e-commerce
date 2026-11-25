import { TriangleAlert } from '@commerce/ui/icons'
import { Alert, AlertTitle } from '@commerce/ui/shadcn/alert'
import Link from 'next/link'
import { paymentModesContent } from '@/data/payment-modes'
import { getCopy } from '@/lib/copy-server'
import { routes } from '@/lib/routes'

/** Admin-wide orange strip while a gateway at checkout runs on its test keys. */
export default async function PaymentsTestBanner() {
  // Hooks
  const { testBar: copy } = await getCopy(paymentModesContent)

  return (
    <Alert
      tone="warning"
      role="status"
      // Same side gutter as the page body (page-body.tsx: px-4 md:px-6), not edge to edge.
      className="mx-4 mb-4 w-auto items-center py-2.5 md:mx-6 text-body *:[svg]:row-span-1 *:[svg]:translate-y-0"
      action={
        <Link href={routes.settings.payments()} className="font-medium text-foreground underline">
          {copy.bannerLink}
        </Link>
      }
    >
      <TriangleAlert aria-hidden="true" weight="fill" />
      <AlertTitle>{copy.banner}</AlertTitle>
    </Alert>
  )
}
