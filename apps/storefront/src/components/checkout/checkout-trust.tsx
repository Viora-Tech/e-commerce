import type { PolicyLink } from '@commerce/core/policies'
import CheckoutIcon from '@/components/checkout/checkout-icon'
import { checkoutContent as content } from '@/data/checkout'
import { PAYMENT_LOGOS } from '@/lib/payment-logos'

type CheckoutTrustProps = {
  /** The gateways taking the payment. */
  names: string[]
  policies: PolicyLink[]
}

const copy = content.trustBlock

/** The lines under the summary card: what is safe, what comes back, and who takes the money. */
export default function CheckoutTrust({ names, policies }: CheckoutTrustProps) {
  // Render logic
  const refund = policies.find((p) => p.type === 'refund-policy')

  return (
    <div className="flex flex-col gap-3 px-1 text-[0.8125rem] leading-snug">
      <p className="flex items-start gap-2.5">
        <CheckoutIcon name="shield" className="mt-0.5! size-4 text-ck-ink" />
        <span>
          <strong className="block font-medium text-ck-ink">{copy.secure.title}</strong>
          <span className="text-ck-muted">{copy.secure.body}</span>
        </span>
      </p>
      {refund ? (
        <p className="flex items-start gap-2.5">
          <CheckoutIcon name="refresh" className="mt-0.5! size-4 text-ck-ink" />
          <span>
            <strong className="block font-medium text-ck-ink">{copy.returns.title}</strong>
            <a
              href={refund.href}
              target="_blank"
              rel="noreferrer"
              className="text-ck-muted! underline-offset-2 hover:text-ck-ink!"
            >
              {copy.returns.body}
            </a>
          </span>
        </p>
      ) : null}
      {names.length > 0 ? (
        <p className="flex items-center gap-2 text-[0.75rem] text-ck-muted">
          {copy.processedBy}
          {names.includes('Razorpay') ? (
            <span className="grid size-4.5 place-items-center rounded-[0.25rem] bg-ck-qr">
              {/* biome-ignore lint/performance/noImgElement: inline data URI, nothing to optimise. */}
              <img src={PAYMENT_LOGOS.razorpay} alt="" className="block h-auto! max-h-3! w-auto!" />
            </span>
          ) : null}
          <strong className="font-medium text-ck-ink">{names.join(' · ')}</strong>
        </p>
      ) : null}
    </div>
  )
}
