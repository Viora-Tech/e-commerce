import { TriangleAlert } from '@commerce/ui/icons'
import { paymentModesContent } from '@/data/payment-modes'
import { useCopy } from '@/hooks/use-copy'

/** The orange "Test mode — payments are not real" bar on Settings → Payments. */
export default function TestModeBar() {
  // Hooks
  const { testBar: copy } = useCopy(paymentModesContent)

  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-xl border border-warning-border bg-warning-soft p-4"
    >
      <TriangleAlert
        aria-hidden="true"
        weight="fill"
        className="mt-0.5 size-5 shrink-0 text-warning"
      />
      <div className="flex flex-col gap-0.5">
        <p className="text-body font-semibold text-foreground">{copy.title}</p>
        <p className="text-body text-muted-foreground">{copy.body}</p>
      </div>
    </div>
  )
}
