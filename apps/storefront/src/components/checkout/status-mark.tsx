import CheckoutIcon from '@/components/checkout/checkout-icon'

type StatusMarkProps = {
  /** `confirmed` is the placed order's tick in the store's accent; `success` the paid one in green. */
  tone: 'confirmed' | 'success' | 'pending' | 'failed'
}

const TONES: Record<StatusMarkProps['tone'], { ring: string; icon: 'check' | 'clock' | 'alert' }> =
  {
    confirmed: {
      ring: 'bg-ck-accent text-ck-accent-ink border-ck-accent [box-shadow:0_0_0_6px_color-mix(in_oklab,var(--ck-accent)_8%,transparent)]',
      icon: 'check',
    },
    success: {
      ring: 'bg-ck-success/12 text-ck-success border-ck-success/25 [box-shadow:0_0_0_6px_color-mix(in_oklab,var(--ck-success)_6%,transparent)]',
      icon: 'check',
    },
    pending: {
      ring: 'bg-ck-accent-soft text-ck-accent border-ck-accent/25 [box-shadow:0_0_0_6px_color-mix(in_oklab,var(--ck-accent)_5%,transparent)]',
      icon: 'clock',
    },
    failed: {
      ring: 'bg-ck-danger-soft text-ck-danger border-ck-danger/25 [box-shadow:0_0_0_6px_color-mix(in_oklab,var(--ck-danger)_5%,transparent)]',
      icon: 'alert',
    },
  }

/** The circle settles in (0.9 -> 1 with the fade, 200ms); reduced motion keeps the fade only. */
const SETTLE =
  'motion-safe:animate-[ck-settle_200ms_var(--ease-out)_both] motion-reduce:animate-[sf-fade_200ms_var(--ease-out)_both]'

/** Then the tick draws itself (140ms in, 260ms long: 400ms in all); not at all with reduced motion. */
const DRAW = 'motion-safe:animate-[ck-draw_260ms_var(--ease-out)_140ms_both]'

/**
 * The round mark at the top of the thank-you page: a tick, a clock or a warning, inside a faint
 * halo. A rare moment, so it gets the one celebratory touch: the circle settles in and the tick
 * draws itself, once, when the page mounts (CSS animations do not replay on a re-render).
 */
export default function StatusMark({ tone }: StatusMarkProps) {
  // Render logic
  const t = TONES[tone]

  return (
    <span
      aria-hidden="true"
      className={`flex size-14 items-center justify-center rounded-full border ${SETTLE} ${t.ring}`}
    >
      {t.icon === 'check' ? (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          focusable="false"
          className="size-7"
        >
          <path d="M5 12.5l4.5 4.5L19 7.5" pathLength={1} strokeDasharray={1} className={DRAW} />
        </svg>
      ) : (
        <CheckoutIcon name={t.icon} className="size-7" />
      )}
    </span>
  )
}
