import CheckoutIcon from '@/components/checkout/checkout-icon'
import PaymentMark, { type PaymentMarkName } from '@/components/checkout/payment-mark'
import { checkoutContent as content } from '@/data/checkout'
import { CK_CARD } from '@/lib/checkout-classes'

type ExpressPayProps = {
  /** Under the buttons: what one tap pays, with which shipping ("Pays ₹648 by UPI, with Standard shipping (₹49)."). */
  line: string
  pending: boolean
  disabled: boolean
  /** Shown under the buttons after a tap with something still missing. */
  message: string | null
  onPay: () => void
}

const copy = content.express

const APPS: { mark: PaymentMarkName; name: string }[] = [
  { mark: 'GPay', name: copy.apps.gpay },
  { mark: 'PhonePe', name: copy.apps.phonepe },
  { mark: 'Paytm', name: copy.apps.paytm },
]

/**
 * Express checkout, its own card at the very top (design: checkout-design Main/Mobile): one
 * tap pays by the store's UPI method, and the app (or its QR on a computer) opens next.
 *
 * Shipping is never skipped: the tap pays with the option picked in the Shipping card below
 * (the cheapest until the shopper picks another), and the line under the buttons says which
 * and what it adds. Before the PIN code is quoted there is no price to pay, so the tap points
 * at what is missing instead (`handleExpress`), as it does for a missing name or address.
 */
export default function ExpressPay({ line, pending, disabled, message, onPay }: ExpressPayProps) {
  return (
    <section
      aria-labelledby="checkout-express-title"
      className={`${CK_CARD} flex flex-col gap-2.5 p-4 sm:gap-3.5 sm:p-5`}
    >
      <h2
        id="checkout-express-title"
        className="font-mono! text-[0.625rem]! font-medium! tracking-[0.08em]! text-ck-muted! uppercase! sm:text-[0.6875rem]!"
      >
        {copy.heading}
      </h2>
      <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
        {APPS.map((app) => (
          <button
            key={app.mark}
            type="button"
            onClick={onPay}
            disabled={disabled || pending}
            aria-label={copy.payWith(app.name)}
            aria-describedby="checkout-express-total"
            className="flex h-11 touch-manipulation items-center justify-center rounded-ck-button! border! border-ck-line! bg-ck-qr! outline-none transition-[scale,border-color] duration-(--duration-press) ease-out hover:border-ck-muted/50! focus-visible:[box-shadow:0_0_0_3px_var(--ck-ring)] active:scale-(--motion-press-scale) disabled:cursor-not-allowed disabled:opacity-55 disabled:active:scale-100"
          >
            {pending ? (
              <CheckoutIcon
                name="spinner"
                className="size-4 animate-spin text-ck-muted motion-reduce:animate-none"
              />
            ) : (
              <PaymentMark mark={app.mark} size="word" />
            )}
          </button>
        ))}
      </div>
      <p id="checkout-express-total" className="text-[0.75rem] text-ck-muted sm:text-[0.8125rem]">
        {line}
      </p>
      {message ? (
        <p
          role="status"
          className="flex items-start gap-2 rounded-ck border border-ck-line bg-ck-canvas px-3 py-2.5 text-[0.8125rem] text-ck-ink transition-[opacity,translate] duration-200 ease-out starting:translate-y-1 starting:opacity-0 motion-reduce:starting:translate-y-0"
        >
          <CheckoutIcon name="alert" className="mt-px! size-4 shrink-0 text-ck-accent" />
          {message}
        </p>
      ) : null}
    </section>
  )
}
