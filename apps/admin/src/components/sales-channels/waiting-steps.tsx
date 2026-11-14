'use client'

import KitButton from '@/components/kit/kit-button'
import DataCard from '@/components/layout/data-card'
import { salesChannelsContent } from '@/data/sales-channels'
import { useCopy } from '@/hooks/use-copy'

type WaitingStepsProps = {
  /** "Meta Commerce Manager", "Google Merchant Center". */
  partner: string
  /** Sign-in with the partner is switched on now: the request can finish in one step. */
  connectNow: boolean
  onConnect: () => void
}

/**
 * Under "Waiting for approval": what happens next, or, once sign-in with the partner is on,
 * "Connect now" so the request does not wait for an approval nobody gives.
 */
export default function WaitingSteps({ partner, connectNow, onConnect }: WaitingStepsProps) {
  // Hooks
  const copy = useCopy(salesChannelsContent.socialPage.waiting)

  // Render logic
  if (connectNow) {
    return (
      <DataCard title={copy.title}>
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-body text-ink-strong">{copy.ready(partner)}</p>
          <KitButton onClick={onConnect}>{copy.connectNow}</KitButton>
        </div>
      </DataCard>
    )
  }
  return (
    <DataCard title={copy.title}>
      <ol className="flex list-decimal flex-col gap-2 pl-5 text-body text-muted-foreground">
        {copy.steps(partner).map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </DataCard>
  )
}
