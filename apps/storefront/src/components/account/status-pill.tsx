type StatusPillProps = {
  label: string
  tone: 'good' | 'neutral' | 'bad'
}

const TONES: Record<StatusPillProps['tone'], string> = {
  good: 'text-ck-success border-ck-success/30 bg-ck-success-soft',
  neutral: 'text-ck-ink border-ck-line-strong bg-ck-soft',
  bad: 'text-ck-danger border-ck-danger/30 bg-ck-danger-soft',
}

/** A small rounded status label for orders, payments, shipments and returns, in the checkout's tokens. */
export default function StatusPill({ label, tone }: StatusPillProps) {
  // Render logic
  return (
    <span
      className={`inline-flex shrink-0 items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[0.75rem] font-medium leading-5 ${TONES[tone]}`}
    >
      {label}
    </span>
  )
}
