type PaymentMarkProps = {
  /** A wordmark for an Express button, or a small chip for the row under a way to pay. */
  mark: PaymentMarkName
  /** `word`: the app's name drawn large on an Express button; `chip`: a small tag. */
  size?: 'word' | 'chip'
}

export type PaymentMarkName = 'GPay' | 'PhonePe' | 'Paytm' | 'UPI' | 'VISA' | 'RuPay' | 'Mastercard'

type ChipLook = { bg: string; fg: string; border: boolean; italic?: boolean }

/*
 * Brand colours are the payment apps' and networks' own, never the merchant's branding:
 * the shopper recognises these marks by them (allow-listed in the hardcoded-colours sweep).
 * They sit on their own white tiles, so they read the same in light and dark checkouts.
 */
const CHIPS: Record<PaymentMarkName, ChipLook> = {
  GPay: { bg: '#FFFFFF', fg: '#3C4043', border: true },
  PhonePe: { bg: '#5F259F', fg: '#FFFFFF', border: false },
  Paytm: { bg: '#FFFFFF', fg: '#00B9F1', border: true },
  UPI: { bg: '#FFFFFF', fg: '#097A44', border: true },
  VISA: { bg: '#1A1F71', fg: '#FFFFFF', border: false, italic: true },
  RuPay: { bg: '#FFFFFF', fg: '#097A44', border: true },
  Mastercard: { bg: '#1F1F1F', fg: '#FFFFFF', border: false },
}

/** "Google" in its four colours, each letter with a stable key. */
const GOOGLE: { key: string; letter: string; colour: string }[] = [
  { key: 'g1', letter: 'G', colour: '#4285F4' },
  { key: 'o1', letter: 'o', colour: '#EA4335' },
  { key: 'o2', letter: 'o', colour: '#FBBC05' },
  { key: 'g2', letter: 'g', colour: '#4285F4' },
  { key: 'l', letter: 'l', colour: '#34A853' },
  { key: 'e', letter: 'e', colour: '#EA4335' },
]

/**
 * A payment app's or card network's mark, drawn in type (no image requests): the Express
 * buttons' wordmarks (Google Pay, PhonePe, Paytm) and the small chips under each way to pay
 * (design: checkout-design Main/Mobile).
 */
export default function PaymentMark({ mark, size = 'chip' }: PaymentMarkProps) {
  // Early returns
  if (mark === 'Mastercard') {
    return (
      <span
        role="img"
        aria-label={mark}
        style={{ backgroundColor: CHIPS.Mastercard.bg }}
        className="inline-flex h-6 items-center rounded-[0.25rem] px-1.5"
      >
        <span style={{ backgroundColor: '#EB001B' }} className="size-3 rounded-full" />
        <span
          style={{ backgroundColor: '#F79E1B' }}
          className="-ml-1 size-3 rounded-full opacity-90"
        />
      </span>
    )
  }
  if (size === 'chip') {
    const look = CHIPS[mark]
    return (
      <span
        style={{ backgroundColor: look.bg, color: look.fg }}
        className={`inline-flex h-6 items-center rounded-[0.25rem] px-2 text-[0.625rem] leading-none font-extrabold tracking-[0.02em] sm:h-[1.375rem] sm:text-[0.625rem] ${look.border ? 'border border-ck-line' : ''} ${look.italic ? 'italic' : ''}`}
      >
        {mark}
      </span>
    )
  }

  return mark === 'GPay' ? (
    <span className="inline-flex items-center gap-1 text-[0.8125rem] font-bold sm:text-[0.9375rem]">
      <span>
        {GOOGLE.map((g) => (
          <span key={g.key} style={{ color: g.colour }}>
            {g.letter}
          </span>
        ))}
      </span>
      <span style={{ color: '#5F6368' }} className="font-semibold">
        Pay
      </span>
    </span>
  ) : mark === 'PhonePe' ? (
    <span
      style={{ color: '#5F259F' }}
      className="inline-flex items-center gap-1.5 text-[0.8125rem] font-bold sm:text-[0.9375rem]"
    >
      <span
        aria-hidden="true"
        style={{ backgroundColor: '#5F259F', color: '#FFFFFF' }}
        className="hidden size-5 items-center justify-center rounded-full text-[0.6875rem] font-extrabold sm:flex"
      >
        पे
      </span>
      PhonePe
    </span>
  ) : mark === 'Paytm' ? (
    <span className="text-[0.875rem] font-extrabold tracking-[-0.02em] sm:text-[1rem]">
      <span style={{ color: '#002E6E' }}>pay</span>
      <span style={{ color: '#00B9F1' }}>tm</span>
    </span>
  ) : (
    <span className="text-[0.875rem] font-bold">{mark}</span>
  )
}
