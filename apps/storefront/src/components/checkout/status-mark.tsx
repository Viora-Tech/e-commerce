import CheckoutIcon from '@/components/checkout/checkout-icon'

type StatusMarkProps = {
  tone: 'success' | 'pending' | 'failed'
}

const TONES: Record<StatusMarkProps['tone'], { ring: string; icon: 'check' | 'clock' | 'alert' }> =
  {
    success: { ring: 'bg-ck-success/12 text-ck-success border-ck-success/25', icon: 'check' },
    pending: { ring: 'bg-ck-accent-soft text-ck-accent border-ck-accent/25', icon: 'clock' },
    failed: { ring: 'bg-ck-danger-soft text-ck-danger border-ck-danger/25', icon: 'alert' },
  }

/** The calm round mark at the top of the thank-you page: a tick, a clock or a warning. */
export default function StatusMark({ tone }: StatusMarkProps) {
  // Render logic
  const t = TONES[tone]

  return (
    <span
      aria-hidden="true"
      className={`flex size-12 items-center justify-center rounded-full border ${t.ring}`}
    >
      <CheckoutIcon name={t.icon} className="size-6" />
    </span>
  )
}
