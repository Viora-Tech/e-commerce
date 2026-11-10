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

/**
 * The card under the summary (Figma 945:519): what is safe and what comes back side by side,
 * then who takes the money under a hairline.
 */
export default function CheckoutTrust({ names, policies }: CheckoutTrustProps) {
  // Render logic
  const refund = policies.find((p) => p.type === 'refund-policy')

  return (
    <div className="flex flex-col gap-3 rounded-ck border border-ck-line bg-ck-soft px-4 py-3.5 text-[0.8125rem] leading-[1.1875rem]">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <p className="flex items-start gap-2.5">
          <CheckoutIcon name="shield" className="size-[1.125rem] text-ck-ink" />
          <span>
            <strong className="block font-semibold text-ck-ink">{copy.secure.title}</strong>
            <span className="text-ck-faint">{copy.secure.body}</span>
          </span>
        </p>
        {refund ? (
          <p className="flex items-start gap-2.5">
            <CheckoutIcon name="refresh" className="size-[1.125rem] text-ck-ink" />
            <span>
              <strong className="block font-semibold text-ck-ink">{copy.returns.title}</strong>
              <a
                href={refund.href}
                target="_blank"
                rel="noreferrer"
                className="text-ck-faint! underline-offset-2 hover:text-ck-ink!"
              >
                {copy.returns.body}
              </a>
            </span>
          </p>
        ) : null}
      </div>
      {names.length > 0 ? (
        <p className="flex items-center gap-2 border-t border-ck-line pt-3 text-[0.75rem] text-ck-faint">
          {copy.processedBy}
          {names.includes('Razorpay') ? (
            <span className="grid size-[1.125rem] place-items-center rounded-[0.25rem] bg-ck-qr">
              {/* biome-ignore lint/performance/noImgElement: inline data URI, nothing to optimise. */}
              <img src={PAYMENT_LOGOS.razorpay} alt="" className="block h-auto! max-h-3! w-auto!" />
            </span>
          ) : null}
          <strong className="font-semibold text-ck-muted">{names.join(' · ')}</strong>
        </p>
      ) : null}
    </div>
  )
}
