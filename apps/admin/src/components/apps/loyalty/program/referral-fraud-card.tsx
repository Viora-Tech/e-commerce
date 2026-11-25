'use client'

import { CheckIcon, ShieldCheck } from '@commerce/ui/icons'
import DataCard from '@/components/layout/data-card'
import StatusChip from '@/components/layout/status-chip'
import { loyaltyProgramContent } from '@/data/loyalty-program'
import { useCopy } from '@/hooks/use-copy'

/** Fraud protection: the checks every referral goes through, grouped in four, always on. */
export default function ReferralFraudCard() {
  // Hooks
  const copy = useCopy(loyaltyProgramContent)

  // Render logic
  const c = copy.referrals

  return (
    <DataCard
      title={
        <span className="flex items-center gap-2">
          <ShieldCheck className="size-4 text-success" />
          {c.fraud}
          <StatusChip tone="success">{c.alwaysOn}</StatusChip>
        </span>
      }
      subtitle={c.fraudHelp}
    >
      <ul className="grid gap-4 sm:grid-cols-2">
        {c.checks.map((check) => (
          <li key={check.title} className="flex gap-2.5">
            <CheckIcon className="mt-0.5 size-4 shrink-0 text-success" />
            <span className="flex flex-col gap-0.5">
              <span className="text-body font-medium text-ink-strong">{check.title}</span>
              <span className="text-caption text-muted-foreground">{check.body}</span>
            </span>
          </li>
        ))}
      </ul>
    </DataCard>
  )
}
