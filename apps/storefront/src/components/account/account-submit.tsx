import CheckoutIcon from '@/components/checkout/checkout-icon'
import { CK_BUTTON_PRIMARY } from '@/lib/checkout-classes'

type AccountSubmitProps = {
  label: string
  /** What it says while the request runs: "Sending code", "Signing in". */
  pendingLabel: string
  pending: boolean
  disabled?: boolean
}

/**
 * The sign-in card's main button, the checkout's Pay button: full width, the store's button
 * colour, an arrow at rest and a spinner (still under reduced motion) while it works.
 */
export default function AccountSubmit({
  label,
  pendingLabel,
  pending,
  disabled = false,
}: AccountSubmitProps) {
  // Render logic
  return (
    <button
      type="submit"
      className={CK_BUTTON_PRIMARY}
      disabled={pending || disabled}
      aria-busy={pending || undefined}
    >
      {pending ? (
        <CheckoutIcon name="spinner" className="size-4 animate-spin motion-reduce:animate-none" />
      ) : null}
      {pending ? pendingLabel : label}
      {pending ? null : <CheckoutIcon name="arrow" className="size-4" />}
    </button>
  )
}
