'use client'

import type { AutopilotProposalView } from '@commerce/api'
import { FESTIVALS } from '@commerce/core/marketing'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import StatusChip from '@/components/layout/status-chip'
import { growthAutopilotContent } from '@/data/growth-home'
import { useCopy, useFormat } from '@/hooks/use-copy'
import type { Formatters } from '@/lib/format'
import { routes } from '@/lib/routes'

type AutopilotProposalRowProps = {
  proposal: AutopilotProposalView
  busy: boolean
  onApprove: () => void
  onDismiss: () => void
}

type Copy = typeof growthAutopilotContent.proposals

const TONE = { proposed: 'attention', scheduled: 'success', dismissed: 'neutral' } as const

/** Why Autopilot proposed it, with the numbers it planned from. */
function reasonOf(p: AutopilotProposalView, copy: Copy, fmt: Formatters): string {
  const n = (key: string) => fmt.number(p.numbers[key] ?? 0)
  const g = copy.goals
  switch (p.goal) {
    case 'recover_carts':
      return g.recover_carts.reason(n('carts'), fmt.money(p.numbers.valuePaise ?? 0))
    case 'new_products':
      return g.new_products.reason(n('products'))
    case 'win_back':
      return g.win_back.reason(n('customers'))
    case 'festive':
      return g.festive.reason(FESTIVALS.find((f) => f.id === p.festival)?.name ?? '')
  }
}

/** One proposal: what and why, who it reaches, when, the offer, and approve or dismiss. */
export default function AutopilotProposalRow({
  proposal: p,
  busy,
  onApprove,
  onDismiss,
}: AutopilotProposalRowProps) {
  // Hooks
  const copy = useCopy(growthAutopilotContent.proposals)
  const fmt = useFormat()

  // Render logic
  const waiting = p.status === 'proposed'
  const meta = [
    p.kind === 'campaign' ? copy.sendAt(fmt.dateTime(p.sendAt)) : null,
    copy.audience(fmt.number(p.audience)),
    p.kind === 'campaign' ? (p.campaign?.segmentName ?? copy.allSubscribers) : null,
    p.kind === 'campaign'
      ? p.discountPercent > 0
        ? copy.discount(p.discountPercent)
        : copy.noDiscount
      : null,
    p.kind === 'campaign' ? (p.aiWritten ? copy.aiWritten : copy.template) : null,
  ].filter(Boolean)

  return (
    <li className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0" aria-busy={busy || undefined}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-body-strong text-foreground">{copy.goals[p.goal].title}</p>
          <p className="text-caption text-muted-foreground">{reasonOf(p, copy, fmt)}</p>
        </div>
        <StatusChip tone={TONE[p.status]}>{copy.statuses[p.status]}</StatusChip>
      </div>
      {p.campaign ? (
        <div className="flex flex-col gap-0.5 rounded-md bg-secondary px-3 py-2">
          <p className="text-body text-foreground">{p.campaign.subject}</p>
          <p className="text-caption text-muted-foreground">{p.campaign.previewText}</p>
        </div>
      ) : null}
      <p className="text-caption text-muted-foreground">{meta.join(' · ')}</p>
      {waiting ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="ghost" disabled={busy} onClick={onDismiss}>
            {copy.dismiss}
          </Button>
          {p.campaignId && p.campaign ? (
            <Button
              variant="outline"
              render={<Link href={routes.growth.campaign(p.campaignId)} />}
              nativeButton={false}
            >
              {copy.open}
            </Button>
          ) : null}
          <Button disabled={busy} onClick={onApprove}>
            {p.kind === 'automation' ? copy.turnOn : copy.approve}
          </Button>
        </div>
      ) : null}
    </li>
  )
}
