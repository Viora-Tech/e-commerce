import type { PaymentMethod } from '../sections/glide/footer'

type PaymentIconProps = {
  method: PaymentMethod
  /** The method's name, read out instead of the drawing. */
  label: string
}

/*
 * Glide drew Shopify's `payment_type_svg_tag` here, which has no source to port. These are
 * our own one-colour marks on a card outline, drawn in currentColor so they follow the
 * footer's ink in every colour scheme; no brand palettes.
 */
const WORDMARK: Partial<Record<PaymentMethod, string>> = {
  upi: 'UPI',
  visa: 'VISA',
  rupay: 'RuPay',
  amex: 'AMEX',
}

export default function PaymentIcon({ method, label }: PaymentIconProps) {
  // Render logic
  const word = WORDMARK[method]

  return (
    <svg
      className="footer__payment-icon"
      viewBox="0 0 38 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={label}
    >
      <rect x="0.5" y="0.5" width="37" height="23" rx="3.5" stroke="currentColor" opacity="0.4" />
      {word ? (
        <text
          x="19"
          y="15.5"
          textAnchor="middle"
          fill="currentColor"
          fontFamily="system-ui, sans-serif"
          fontSize={word.length > 4 ? 8 : 9}
          fontStyle={method === 'visa' ? 'italic' : 'normal'}
          fontWeight={800}
          letterSpacing={method === 'upi' ? 0.6 : 0}
        >
          {word}
        </text>
      ) : null}
      {method === 'mastercard' ? (
        <>
          <circle cx="15.5" cy="12" r="6" fill="currentColor" opacity="0.85" />
          <circle cx="22.5" cy="12" r="6" stroke="currentColor" strokeWidth="1.4" />
        </>
      ) : null}
      {method === 'netbanking' ? (
        <path
          d="M12 10.5 19 7l7 3.5M13.5 11v5.5M17 11v5.5M21 11v5.5M24.5 11v5.5M12 17.5h14"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
    </svg>
  )
}
