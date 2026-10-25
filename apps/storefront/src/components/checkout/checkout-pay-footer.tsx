import type { PolicyLink } from '@commerce/core/policies'
import type { ReactNode } from 'react'
import CheckoutAgreement from '@/components/checkout/checkout-agreement'
import CheckoutIcon from '@/components/checkout/checkout-icon'
import TrustLine from '@/components/checkout/trust-line'
import { checkoutContent as content } from '@/data/checkout'

type CheckoutPayFooterProps = {
  /** Why the server refused the order, or what to fix before going on. */
  error: string | null
  /** Settings → Checkout's minimum order, when the cart is short of it. */
  shortfall: string | null
  /** Back and the step's main button (`CheckoutStepNav`). */
  nav: ReactNode
  /** Published policies, on the paying step only (empty elsewhere). */
  policies: PolicyLink[]
  /** The trust line's ways to pay; null when the merchant turned it off or before paying. */
  trust: string[] | null
  /** The gateways that handle the money ("Razorpay", "Cashfree"), on the paying step only. */
  processors?: string[]
}

/**
 * The end of every step: what stops the order (if anything), Back and the main button, and
 * on the paying step the fine print. A fragment, so the buttons are a direct child of the
 * form and can stick to the bottom of a phone screen for the whole length of it.
 */
export default function CheckoutPayFooter({
  error,
  shortfall,
  nav,
  policies,
  trust,
  processors = [],
}: CheckoutPayFooterProps) {
  return (
    <>
      {shortfall ? (
        <p
          role="status"
          className="rounded-ck border border-ck-line bg-ck-field px-4 py-3 text-[0.875rem] text-ck-ink"
        >
          {shortfall}
        </p>
      ) : null}
      {/* Out of the flow while empty (no gap), still in the accessibility tree so it announces. */}
      <div aria-live="assertive" className="empty:absolute">
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
      {nav}
      <CheckoutAgreement policies={policies} />
      {trust ? <TrustLine methods={trust} /> : null}
      {processors.length > 0 ? (
        <p className="-mt-4! text-center text-[0.75rem] text-ck-muted">
          {content.processors(processors)}
        </p>
      ) : null}
    </>
  )
}
