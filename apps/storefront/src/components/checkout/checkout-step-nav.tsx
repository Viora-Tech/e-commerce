import CheckoutIcon from '@/components/checkout/checkout-icon'
import { checkoutContent as content } from '@/data/checkout'
import { CK_BUTTON_PRIMARY, CK_BUTTON_SECONDARY } from '@/lib/checkout-classes'

type CheckoutStepNavProps = {
  /** "Continue to shipping", "Pay ₹7,499", "Place order · ₹7,499": always says what happens. */
  label: string
  /** The last step pays (a lock); the others continue (an arrow). */
  pays: boolean
  /** The order is being placed: a spinner, and the button cannot be pressed twice. */
  pending: boolean
  /** The amount or the options are being re-quoted: a shimmer stands in, the button waits. */
  updating: boolean
  disabled: boolean
  /** The step before, or null on the first step. */
  onBack: (() => void) | null
  backLabel: string
}

/**
 * Back and the step's main button. The main button submits the one checkout form, so Enter
 * in a field does the same. Sticky at the bottom of a phone screen (Back shrinks to an
 * arrow there), a plain row at the end of the step from `lg` up. A direct child of the form
 * so it can stick for the whole length of it.
 */
export default function CheckoutStepNav({
  label,
  pays,
  pending,
  updating,
  disabled,
  onBack,
  backLabel,
}: CheckoutStepNavProps) {
  return (
    <div className="sticky bottom-0 z-10 -mx-5! flex items-center gap-3 border-t border-ck-line bg-ck-bg/95 px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur supports-[backdrop-filter]:bg-ck-bg/85 sm:-mx-8! sm:px-8 lg:static lg:mx-0! lg:justify-between lg:border-0 lg:bg-transparent lg:p-0 lg:backdrop-blur-none">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          aria-label={backLabel}
          className={`${CK_BUTTON_SECONDARY} h-13! w-13 shrink-0 touch-manipulation px-0! lg:w-auto lg:px-5!`}
        >
          <CheckoutIcon name="back" className="size-4" />
          <span className="hidden lg:inline">{content.steps.back}</span>
        </button>
      ) : (
        <span aria-hidden="true" className="hidden lg:block" />
      )}
      <button
        type="submit"
        disabled={disabled || pending || updating}
        aria-busy={pending || updating}
        className={`${CK_BUTTON_PRIMARY} flex-1 touch-manipulation lg:w-auto lg:min-w-[14rem] lg:flex-none`}
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
        ) : pays ? (
          <>
            <CheckoutIcon name="lock" className="size-4 opacity-80" />
            {label}
          </>
        ) : (
          <>
            {label}
            <CheckoutIcon name="back" className="size-4 rotate-180" />
          </>
        )}
      </button>
    </div>
  )
}
