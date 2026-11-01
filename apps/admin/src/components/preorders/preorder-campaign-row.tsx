'use client'

import type { PreorderCampaignSummary } from '@commerce/core'
import Link from 'next/link'
import StatusChip from '@/components/layout/status-chip'
import SettingsTableCell from '@/components/settings/settings-table-cell'
import SettingsTableRow from '@/components/settings/settings-table-row'
import { preordersContent } from '@/data/preorders'
import { useCopy } from '@/hooks/use-copy'
import { formatPaise } from '@/lib/money'
import { routes } from '@/lib/routes'

type PreorderCampaignRowProps = {
  campaign: PreorderCampaignSummary
}

/** One campaign: its name, how many products, its orders and revenue, and whether it runs. */
export default function PreorderCampaignRow({ campaign: c }: PreorderCampaignRowProps) {
  // Hooks
  const copy = useCopy(preordersContent)

  return (
    <SettingsTableRow>
      <SettingsTableCell>
        <Link
          href={routes.products.preorderCampaign(c.id)}
          className="truncate font-semibold text-ink-strong hover:underline focus-visible:underline focus-visible:outline-none"
        >
          {c.name}
        </Link>
      </SettingsTableCell>
      <SettingsTableCell className="hidden tabular-nums text-muted-foreground sm:table-cell">
        {copy.campaigns.productCount(c.productCount)}
      </SettingsTableCell>
      <SettingsTableCell className="hidden tabular-nums md:table-cell">
        {c.orderCount}
      </SettingsTableCell>
      <SettingsTableCell className="hidden tabular-nums md:table-cell">
        {formatPaise(c.revenuePaise)}
      </SettingsTableCell>
      <SettingsTableCell center>
        <StatusChip tone={c.status === 'active' ? 'success' : 'neutral'}>
          {copy.statuses[c.status]}
        </StatusChip>
      </SettingsTableCell>
    </SettingsTableRow>
  )
}
