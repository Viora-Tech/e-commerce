'use client'

import type { ReferralReward } from '@commerce/core/loyalty'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import DataCard from '@/components/layout/data-card'
import { loyaltyProgramContent } from '@/data/loyalty-program'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { rewardText } from './referral-party-card'

type ReferralPopupCardProps = {
  friendReward: ReferralReward
  /** Customize › App embeds on the live theme; null when the store has no theme. */
  editHref: string | null
}

/** The referral pop-up a friend sees on arriving, in miniature, with Edit to open Customize. */
export default function ReferralPopupCard({ friendReward, editHref }: ReferralPopupCardProps) {
  // Hooks
  const copy = useCopy(loyaltyProgramContent)
  const fmt = useFormat()

  // Render logic
  const c = copy.referrals.popup
  const reward = rewardText(friendReward, copy.referrals, fmt.money)

  return (
    <DataCard
      title={c.heading}
      subtitle={c.help}
      action={
        editHref ? (
          <Button
            size="sm"
            variant="outline"
            nativeButton={false}
            render={<Link href={editHref} />}
          >
            {c.edit}
          </Button>
        ) : (
          <Button size="sm" variant="outline" disabled>
            {c.edit}
          </Button>
        )
      }
    >
      <div aria-hidden className="rounded-lg bg-muted p-4">
        <div className="flex flex-col gap-3 rounded-lg border border-line bg-card p-4 shadow-xs">
          <span className="text-card-title text-ink-strong">{c.title(reward)}</span>
          <span className="text-caption text-muted-foreground">{c.body}</span>
          <span className="rounded-md border border-line px-3 py-2 text-caption text-muted-foreground">
            {c.name}
          </span>
          <span className="rounded-md border border-line px-3 py-2 text-caption text-muted-foreground">
            {c.email}
          </span>
          <span className="rounded-md bg-primary px-3 py-2 text-center text-caption font-medium text-primary-foreground">
            {c.button}
          </span>
        </div>
      </div>
    </DataCard>
  )
}
