import { ArrowLeft } from '@commerce/ui/icons'
import Link from 'next/link'
import { paymentsSetupContent } from '@/data/payments-setup'
import { useCopy } from '@/hooks/use-copy'

/** "← Payments": the plain way back to Settings → Payments (full page, never the guide). */
export default function BackToPayments() {
  // Hooks
  const copy = useCopy(paymentsSetupContent)

  return (
    <Link
      href={PAYMENTS_PAGE_HREF}
      className="inline-flex w-fit items-center gap-1.5 rounded-md text-body font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <ArrowLeft aria-hidden="true" className="size-4" />
      {copy.backToPayments}
    </Link>
  )
}

/** `view=page` opens the full page even for a shop that hasn't finished the guide. */
export const PAYMENTS_PAGE_HREF = '/settings/payments?view=page'
