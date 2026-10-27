import { TriangleAlert } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { paymentModesContent } from '@/data/payment-modes'
import { useCopy } from '@/hooks/use-copy'

type TestModeBarProps = {
  /** `card`: the slimmer strip inside a gateway's card. */
  variant?: 'page' | 'card'
}

/** The amber "Test mode — no real money moves" bar: Settings → Payments, a gateway's card and page. */
export default function TestModeBar({ variant = 'page' }: TestModeBarProps) {
  // Hooks
  const { testBar: copy } = useCopy(paymentModesContent)

  // Render logic
  const card = variant === 'card'

  return (
    <div
      role="status"
      className={cn(
        'flex items-start gap-3 border border-warning-border bg-warning-soft',
        card ? 'rounded-lg px-3 py-2.5' : 'rounded-xl p-4',
      )}
    >
      <TriangleAlert
        aria-hidden="true"
        weight="fill"
        className={cn('shrink-0 text-warning', card ? 'mt-0.5 size-4' : 'mt-0.5 size-5')}
      />
      <div className="flex flex-col gap-0.5">
        <p className="text-body font-semibold text-foreground">{card ? copy.note : copy.title}</p>
        <p className={cn('text-muted-foreground', card ? 'text-caption' : 'text-body')}>
          {card ? copy.noteBody : copy.body}
        </p>
      </div>
    </div>
  )
}
