import type { ReactNode } from 'react'

type SummaryRowProps = {
  label: ReactNode
  value: ReactNode
  /** `total` is the bold line; `saving` reads as money off; `muted` is a side note. */
  tone?: 'default' | 'saving' | 'total' | 'muted'
}

const TONES: Record<NonNullable<SummaryRowProps['tone']>, string> = {
  default: 'text-[0.875rem]',
  saving: 'text-[0.875rem]',
  total: 'text-[0.9375rem] font-semibold',
  muted: 'text-[0.8125rem] text-ck-summary-muted',
}

/** A label and an amount on one line of the order summary. */
export default function SummaryRow({ label, value, tone = 'default' }: SummaryRowProps) {
  return (
    <div className={`flex items-baseline justify-between gap-4 ${TONES[tone]}`}>
      <dt className={tone === 'default' || tone === 'saving' ? 'text-ck-summary-muted' : ''}>
        {label}
      </dt>
      <dd className="shrink-0 text-right tabular-nums">{value}</dd>
    </div>
  )
}
