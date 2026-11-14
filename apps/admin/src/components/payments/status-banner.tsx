import { CircleAlert, CircleCheck } from '@commerce/ui/icons'
import { Alert, AlertDescription, AlertTitle } from '@commerce/ui/shadcn/alert'
import { paymentsSetupContent } from '@/data/payments-setup'
import { useCopy } from '@/hooks/use-copy'

type StatusBannerProps = {
  canTakePayments: boolean
  canTakeOnline: boolean
}

/** The one line at the top: can this shop take money right now, and if not, what's missing. */
export default function StatusBanner({ canTakePayments, canTakeOnline }: StatusBannerProps) {
  // Hooks
  const { status: copy } = useCopy(paymentsSetupContent)

  // Render logic
  const title = canTakeOnline ? copy.ready : canTakePayments ? copy.readyOffline : copy.notReady
  const help = canTakeOnline ? null : canTakePayments ? copy.offlineHelp : copy.notReadyHelp
  const Icon = canTakeOnline ? CircleCheck : CircleAlert
  const tone = canTakeOnline ? 'success' : canTakePayments ? 'neutral' : 'danger'

  return (
    <Alert role="status" tone={tone} className="p-4">
      {canTakePayments && !canTakeOnline ? null : (
        <Icon aria-hidden="true" weight="fill" className="size-5" />
      )}
      <AlertTitle className="text-body font-semibold">{title}</AlertTitle>
      {help ? <AlertDescription className="text-body">{help}</AlertDescription> : null}
    </Alert>
  )
}
