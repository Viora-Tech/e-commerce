import { CircleAlert } from '@commerce/ui/icons'
import { Alert, AlertDescription, AlertTitle } from '@commerce/ui/shadcn/alert'
import { razorpayWebsitesContent } from '@/data/razorpay-websites'
import { useCopy, useFormat } from '@/hooks/use-copy'
import type { PaymentsSetup } from './types'

type RazorpayWebsiteBannerProps = {
  block: NonNullable<PaymentsSetup['razorpayWebsiteBlock']>
  /** The store's web addresses; Razorpay's payload does not say which one the payment came from. */
  websites: string[]
  /** Where the websites card is (the Payment providers row), for the "See the websites" link. */
  listHref: string
}

/** "Razorpay is blocking payments from your website": shown for 7 days after such a refusal. */
export default function RazorpayWebsiteBanner({
  block,
  websites,
  listHref,
}: RazorpayWebsiteBannerProps) {
  // Hooks
  const { banner: copy } = useCopy(razorpayWebsitesContent)
  const fmt = useFormat()

  // Render logic
  const sites = websites.length ? websites.join(', ') : copy.yourWebsite

  return (
    <Alert variant="destructive" className="rounded-xl p-4">
      <CircleAlert />
      <AlertTitle>{copy.title}</AlertTitle>
      <AlertDescription className="flex flex-col gap-1">
        <span>{copy.body(sites)}</span>
        <span>{copy.when(fmt.when(block.at))}</span>
        <a href={listHref} className="w-fit font-medium underline underline-offset-2">
          {copy.action}
        </a>
      </AlertDescription>
    </Alert>
  )
}
