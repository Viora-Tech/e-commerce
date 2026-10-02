import type { PolicyLink } from '@commerce/core/policies'
import CheckoutAgreement from '@/components/checkout/checkout-agreement'
import CheckoutIcon from '@/components/checkout/checkout-icon'
import PayButton from '@/components/checkout/pay-button'
import TrustLine from '@/components/checkout/trust-line'

type CheckoutPayFooterProps = {
  /** Why the server refused the order, or what to fix before paying. */
  error: string | null
  /** Settings → Checkout's minimum order, when the cart is short of it. */
  shortfall: string | null
  payLabel: string
  pending: boolean
  updating: boolean
  disabled: boolean
  policies: PolicyLink[]
  /** The trust line's ways to pay; null when the merchant turned the line off. */
  trust: string[] | null
}

/**
 * The end of the form: what stops the order (if anything), the Pay button, the fine print.
 * A fragment, so the Pay button is a direct child of the form and can stick to the bottom
 * of a phone screen for the whole length of the form.
 */
export default function CheckoutPayFooter({
  error,
  shortfall,
  payLabel,
  pending,
  updating,
  disabled,
  policies,
  trust,
}: CheckoutPayFooterProps) {
  return (
    <>
      {shortfall ? (
        <p role="status" className="rounded-ck bg-ck-soft px-4 py-3 text-[0.875rem] text-ck-ink">
          {shortfall}
        </p>
      ) : null}
      <div aria-live="assertive">
        {error ? (
          <p
            id="checkout-error"
            className="flex items-start gap-2.5 rounded-ck border border-ck-danger/35 bg-ck-danger-soft px-4 py-3 text-[0.875rem] leading-snug text-ck-danger"
          >
            <CheckoutIcon name="alert" className="mt-0.5! size-4" />
            {error}
          </p>
        ) : null}
      </div>
      <PayButton label={payLabel} pending={pending} updating={updating} disabled={disabled} />
      <CheckoutAgreement policies={policies} />
      {trust ? <TrustLine methods={trust} /> : null}
    </>
  )
}
