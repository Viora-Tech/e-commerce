import { CreditCard } from '@commerce/ui/icons'
import { Alert, AlertDescription, AlertTitle } from '@commerce/ui/shadcn/alert'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { affiliatePortalContent } from '@/data/affiliate-portal'

type PayoutBannerProps = { href: string }

const copy = affiliatePortalContent.dashboard.banner

/** The dashboard's plain nudge while they have no UPI ID or bank account saved. */
export default function PayoutBanner({ href }: PayoutBannerProps) {
  // Render logic
  return (
    <div className="px-4 lg:px-6">
      <Alert
        action={
          <Button size="sm" variant="outline" nativeButton={false} render={<Link href={href} />}>
            {copy.action}
          </Button>
        }
      >
        <CreditCard />
        <AlertTitle>{copy.title}</AlertTitle>
        <AlertDescription>{copy.body}</AlertDescription>
      </Alert>
    </div>
  )
}
