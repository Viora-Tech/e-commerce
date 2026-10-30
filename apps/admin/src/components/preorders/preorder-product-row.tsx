'use client'

import type { PreorderProductRow as Row } from '@commerce/core'
import Link from 'next/link'
import StatusChip from '@/components/layout/status-chip'
import SettingsTableCell from '@/components/settings/settings-table-cell'
import SettingsTableRow from '@/components/settings/settings-table-row'
import { preordersContent } from '@/data/preorders'
import { useCopy } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'

type PreorderProductRowProps = {
  product: Row
}

const TONE = { active: 'success', full: 'attention', off: 'neutral' } as const

/** Share of the limit still free, 0-100, for the bar's width. */
const leftShare = (left: number, limit: number) =>
  limit > 0 ? Math.round((Math.min(left, limit) / limit) * 100) : 0

/** One pre-order product: its campaign, orders, the "10 of 10 left" bar and its status. */
export default function PreorderProductRow({ product: p }: PreorderProductRowProps) {
  // Hooks
  const copy = useCopy(preordersContent)

  // Render logic
  const t = copy.products

  return (
    <SettingsTableRow>
      <SettingsTableCell>
        <Link
          href={routes.products.detail(p.id)}
          className="truncate font-semibold text-ink-strong hover:underline focus-visible:underline focus-visible:outline-none"
        >
          {p.title}
        </Link>
      </SettingsTableCell>
      <SettingsTableCell className="hidden text-muted-foreground md:table-cell">
        {p.campaignId && p.campaignName ? (
          <Link href={routes.products.preorderCampaign(p.campaignId)} className="hover:underline">
            {p.campaignName}
          </Link>
        ) : (
          t.ownSettings
        )}
      </SettingsTableCell>
      <SettingsTableCell className="hidden tabular-nums sm:table-cell">{p.orderCount}</SettingsTableCell>
      <SettingsTableCell>
        {p.limit != null && p.left != null ? (
          <div className="flex min-w-32 flex-col gap-1">
            <span className="text-caption tabular-nums text-muted-foreground">
              {t.left(p.left, p.limit)}
            </span>
            <div
              role="meter"
              aria-label={t.leftAria(p.left, p.limit)}
              aria-valuemin={0}
              aria-valuemax={p.limit}
              aria-valuenow={p.left}
              className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
            >
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${leftShare(p.left, p.limit)}%` }}
              />
            </div>
          </div>
        ) : (
          <span className="text-muted-foreground">{t.unlimited}</span>
        )}
      </SettingsTableCell>
      <SettingsTableCell center>
        <StatusChip tone={TONE[p.status]}>{t.statuses[p.status]}</StatusChip>
      </SettingsTableCell>
    </SettingsTableRow>
  )
}
