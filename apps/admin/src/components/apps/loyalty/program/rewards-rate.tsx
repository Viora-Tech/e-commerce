'use client'

import { loyaltyProgramContent } from '@/data/loyalty-program'
import { useCopy } from '@/hooks/use-copy'
import { percentText } from '../setup-bar'

type RewardsRateProps = {
  /** Rewards given back as a percent of spend. */
  percent: number
}

/** Below 1% is low for a store, above 5% is high. */
const levelOf = (n: number) => (n < 1 ? 'low' : n > 5 ? 'high' : 'typical')

/** "Rewards rate 1% | Typical": what the program gives back on spend, in a word. */
export default function RewardsRate({ percent }: RewardsRateProps) {
  // Hooks
  const copy = useCopy(loyaltyProgramContent)

  // Render logic
  const c = copy.rate

  return (
    <div
      title={c.help}
      className="flex items-center divide-x divide-line rounded-md border border-line bg-card text-body"
    >
      <span className="flex items-center gap-1.5 px-3 py-1.5">
        <span className="text-muted-foreground">{c.label}</span>
        <span className="font-semibold tabular-nums text-ink-strong">{percentText(percent)}</span>
      </span>
      <span className="px-3 py-1.5 text-foreground">{c.levels[levelOf(percent)]}</span>
    </div>
  )
}
