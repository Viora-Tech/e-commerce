import { TriangleAlert } from '@commerce/ui/icons'
import Link from 'next/link'
import { paymentModesContent } from '@/data/payment-modes'
import { getCopy } from '@/lib/copy-server'
import { routes } from '@/lib/routes'

/** Admin-wide orange strip while a gateway at checkout runs on its test keys. */
export default async function PaymentsTestBanner() {
  // Hooks
  const { testBar: copy } = await getCopy(paymentModesContent)

  return (
    <div
      role="status"
      className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-warning-border bg-warning-soft px-4 py-2.5 text-body text-foreground"
    >
      <TriangleAlert aria-hidden="true" weight="fill" className="size-4 shrink-0 text-warning" />
      <p className="min-w-0 flex-1 font-medium">{copy.banner}</p>
      <Link href={routes.settings.payments()} className="font-medium text-foreground underline">
        {copy.bannerLink}
      </Link>
    </div>
  )
}
