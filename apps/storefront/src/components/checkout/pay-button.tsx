import CheckoutIcon from '@/components/checkout/checkout-icon'
import { checkoutContent as content } from '@/data/checkout'
import { CK_BUTTON_PRIMARY } from '@/lib/checkout-classes'

type PayButtonProps = {
  /** "Pay ₹7,499" or "Place order · ₹7,499": always the exact amount. */
  label: string
  /** The order is being placed: a spinner, and the button cannot be pressed twice. */
  pending: boolean
  /** The amount is being re-quoted: a shimmer stands in for it, the button waits. */
  updating: boolean
  disabled: boolean
}

/**
 * The submit button. Sticky at the bottom of a phone screen so it is always one tap away,
 * a normal button at the end of the form from `lg` up.
 */
export default function PayButton({ label, pending, updating, disabled }: PayButtonProps) {
  return (
    <div className="sticky bottom-0 z-10 -mx-5! border-t border-ck-line bg-ck-bg/95 px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur supports-[backdrop-filter]:bg-ck-bg/85 sm:-mx-8! sm:px-8 lg:static lg:mx-0! lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
      <button
        type="submit"
        disabled={disabled || pending || updating}
        aria-busy={pending || updating}
        className={CK_BUTTON_PRIMARY}
      >
        {pending ? (
          <>
            <CheckoutIcon
              name="spinner"
              className="size-[1.125rem] animate-spin motion-reduce:animate-none"
            />
            {content.processing}
          </>
        ) : updating ? (
          <>
            <span
              aria-hidden="true"
              className="h-4 w-28 animate-pulse rounded bg-ck-button-ink/25 motion-reduce:animate-none"
            />
            <span className="sr-only">{label}</span>
          </>
        ) : (
          <>
            <CheckoutIcon name="lock" className="size-4 opacity-80" />
            {label}
          </>
        )}
      </button>
    </div>
  )
}
