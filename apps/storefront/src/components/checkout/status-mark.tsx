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

/**
 * The calm round mark at the top of the thank-you page: a tick, a clock or a warning, inside a
 * faint halo. It settles in once (scale and fade, under 250ms), and not at all with reduced motion.
 */
export default function StatusMark({ tone }: StatusMarkProps) {
  // Render logic
  const t = TONES[tone]

  return (
    <span
      aria-hidden="true"
      className={`flex size-14 items-center justify-center rounded-full border motion-safe:animate-[ck-settle_220ms_cubic-bezier(0.22,1,0.36,1)_both] ${t.ring}`}
    >
      <CheckoutIcon name={t.icon} className="size-7" />
    </span>
  )
}
