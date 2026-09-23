type StatusPillProps = {
  label: string
  tone: 'good' | 'neutral' | 'bad'
}

const TONES: Record<StatusPillProps['tone'], string> = {
  good: 'text-success border-success/40 bg-success/10',
  neutral: 'text-ink border-line bg-surface',
  bad: 'text-danger border-danger/40 bg-danger/10',
}

/** A small rounded status label for orders, payments and shipments. */
export default function StatusPill({ label, tone }: StatusPillProps) {
  // Render logic
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[0.8125rem] font-medium leading-5 ${TONES[tone]}`}
    >
      {label}
    </span>
  )
}
