import CheckoutIcon from '@/components/checkout/checkout-icon'
import { checkoutContent as content } from '@/data/checkout'

type ExpressPayProps = {
  amountLabel: string
  pending: boolean
  disabled: boolean
  /** Shown under the button after a tap with details still missing. */
  message: string | null
  onPay: () => void
}

/**
 * UPI at the very top, the way most Indian shoppers pay. One tap pays with the store's
 * UPI method when the details below are complete (a signed-in shopper's usually are);
 * otherwise it points at what is missing. Same order flow as the Pay button underneath.
 */
export default function ExpressPay({
  amountLabel,
  pending,
  disabled,
  message,
  onPay,
}: ExpressPayProps) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-[0.8125rem] font-medium text-ck-muted">{content.express.heading}</p>
      <button
        type="button"
        onClick={onPay}
        disabled={disabled || pending}
        aria-describedby={message ? 'express-pay-message' : undefined}
        className="group inline-flex h-13 w-full items-center justify-center gap-2.5 rounded-ck-button! border! border-ck-ink! bg-ck-ink! px-5 text-[1rem]! font-semibold! text-ck-bg! [box-shadow:0_1px_2px_rgb(0_0_0/0.1)] outline-none transition-[filter,transform] duration-150 hover:brightness-[1.15] active:scale-[0.995] focus-visible:[box-shadow:0_0_0_3px_var(--ck-ring)] disabled:cursor-not-allowed disabled:opacity-55 motion-reduce:transition-none motion-reduce:active:scale-100"
      >
        <CheckoutIcon name="phone" className="size-[1.125rem]" />
        <span>{content.express.upi}</span>
        <span aria-hidden="true" className="font-normal opacity-60">
          ·
        </span>
        <span className="font-normal tabular-nums opacity-80">{amountLabel}</span>
      </button>
      <p className="text-center text-[0.8125rem] text-ck-muted">{content.methods.upiHint}</p>
      {message ? (
        <p
          id="express-pay-message"
          role="status"
          className="flex items-start gap-2 rounded-ck bg-ck-soft px-3.5 py-3 text-[0.8125rem] text-ck-ink"
        >
          <CheckoutIcon name="alert" className="mt-px! size-4 text-ck-accent" />
          {message}
        </p>
      ) : null}
      <div className="flex items-center gap-3 pt-2 text-[0.8125rem] text-ck-muted">
        <span className="h-px flex-1 bg-ck-line" />
        {content.express.or}
        <span className="h-px flex-1 bg-ck-line" />
      </div>
    </div>
  )
}
