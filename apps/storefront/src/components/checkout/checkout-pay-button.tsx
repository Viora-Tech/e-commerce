import CheckoutIcon from '@/components/checkout/checkout-icon'
import { checkoutContent as content } from '@/data/checkout'
import { CK_BUTTON_PRIMARY } from '@/lib/checkout-classes'

type CheckoutPayButtonProps = {
  /** The checkout form's id: the button may sit outside it (the summary card on a computer). */
  form: string
  /** "Pay ₹7,499", "Place order · ₹7,499": always says what happens. */
  label: string
  /** The order is being placed: a spinner, and the button cannot be pressed twice. */
  pending: boolean
  /** The amount is being re-quoted: a shimmer stands in, the button waits. */
  updating: boolean
  disabled: boolean
}

/**
 * Pay (design: "🔒 Pay ₹X"): submits the one checkout form, so Enter in a field does the
 * same. Pressed it settles to 0.97 in 140ms ease-out (`CK_BUTTON_PRIMARY`).
 */
export default function CheckoutPayButton({
  form,
  label,
  pending,
  updating,
  disabled,
}: CheckoutPayButtonProps) {
  return (
    <button
      type="submit"
      form={form}
      disabled={disabled || pending || updating}
      aria-busy={pending || updating}
      className={`${CK_BUTTON_PRIMARY} lg:h-12`}
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
          <CheckoutIcon name="lock" className="size-4" />
          {label}
        </>
      )}
    </button>
  )
}
