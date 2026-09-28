import { CircleAlert, CircleCheck } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
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

  return (
    <div
      role="status"
      className={cn(
        'flex items-start gap-3 rounded-xl border p-4',
        canTakeOnline
          ? 'border-success/30 bg-success-soft'
          : canTakePayments
            ? 'border-warning/40 bg-warning-soft'
            : 'border-destructive/30 bg-destructive/5',
      )}
    >
      <Icon
        aria-hidden="true"
        weight="fill"
        className={cn(
          'mt-0.5 size-5 shrink-0',
          canTakeOnline
            ? 'text-success'
            : canTakePayments
              ? 'text-warning-foreground dark:text-warning'
              : 'text-destructive',
        )}
      />
      <div className="flex flex-col gap-0.5">
        <p className="text-body font-semibold text-foreground">{title}</p>
        {help ? <p className="text-body text-muted-foreground">{help}</p> : null}
      </div>
    </div>
  )
}
