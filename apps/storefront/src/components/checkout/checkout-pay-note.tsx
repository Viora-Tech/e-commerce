import CheckoutIcon from '@/components/checkout/checkout-icon'
import { checkoutContent as content } from '@/data/checkout'

type CheckoutPayNoteProps = {
  /** The gateways taking the payment; none says the plain line. */
  names: string[]
  /** In the summary card, which has its own text colours; otherwise the phone's Pay bar. */
  inSummary?: boolean
}

/** The one line under Pay: a lock, then who handles the money, with their name in full ink. */
export default function CheckoutPayNote({ names, inSummary = false }: CheckoutPayNoteProps) {
  // Render logic
  const tone = inSummary ? 'text-ck-summary-muted' : 'text-ck-muted'
  const ink = inSummary ? 'text-ck-summary-ink' : 'text-ck-ink'

  return (
    <p className={`flex items-center justify-center gap-1.5 text-[0.8125rem] ${tone}`}>
      <CheckoutIcon name="lock" className="size-3.5" />
      {names.length > 0 ? (
        <span>
          {content.payNote.by}{' '}
          <strong className={`font-semibold ${ink}`}>{names.join(' · ')}</strong>
        </span>
      ) : (
        <span>{content.payNote.plain}</span>
      )}
    </p>
  )
}
