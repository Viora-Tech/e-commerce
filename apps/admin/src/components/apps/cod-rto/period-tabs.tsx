'use client'

import PillTabs from '@/components/layout/pill-tabs'
import { codRtoContent } from '@/data/cod-rto'
import { useCopy } from '@/hooks/use-copy'

export type Period = '7' | '30' | '90'

type PeriodTabsProps = {
  value: Period
  onChange: (p: Period) => void
}

const PERIODS: Period[] = ['7', '30', '90']

/** The report window switch on the COD & RTO pages. */
export default function PeriodTabs({ value, onChange }: PeriodTabsProps) {
  // Hooks
  const copy = useCopy(codRtoContent)

  // Render logic
  return (
    <PillTabs
      variant="segmented"
      value={value}
      onChange={onChange}
      tabs={PERIODS.map((p) => ({ value: p, label: copy.periods[Number(p)] ?? p }))}
    />
  )
}
