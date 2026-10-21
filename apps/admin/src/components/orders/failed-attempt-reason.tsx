import { isWebsiteNotRegistered } from '@commerce/payments/failure-reasons'
import { razorpayWebsitesContent } from '@/data/razorpay-websites'
import { useCopy } from '@/hooks/use-copy'

type FailedAttemptReasonProps = {
  provider: string
  /** The gateway's reason, as stored on the attempt. */
  error: string
}

/** Why a payment attempt failed, in the gateway's words, plus the fix when it is a known one. */
export default function FailedAttemptReason({ provider, error }: FailedAttemptReasonProps) {
  // Hooks
  const { attempt: copy } = useCopy(razorpayWebsitesContent)

  // Render logic
  const websiteBlock = provider.startsWith('razorpay') && isWebsiteNotRegistered(error)

  return (
    <p className="text-body text-destructive">
      <span className="font-medium">{copy.failedReason}: </span>
      <span className="break-words">{error}</span>
      {websiteBlock ? <span className="block text-caption">{copy.websiteFix}</span> : null}
    </p>
  )
}
