'use client'

import type { RolloutView } from '@commerce/core'
import { Globe } from '@commerce/ui/icons'
import Link from 'next/link'
import SettingsTableCell from '@/components/settings/settings-table-cell'
import SettingsTableRow from '@/components/settings/settings-table-row'
import { rolloutsContent } from '@/data/rollouts'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'
import { changesSummary } from './rollout-form-state'
import RolloutStatusChip from './rollout-status-chip'

type RolloutRowProps = {
  rollout: RolloutView
}

/** One rollout, as Shopify's row: name, status, type, start, end, audience and its changes. */
export default function RolloutRow({ rollout: r }: RolloutRowProps) {
  // Hooks
  const copy = useCopy(rolloutsContent)
  const fmt = useFormat()

  // Render logic
  const start = r.startedAt ?? r.startsAt
  const end = r.endedAt ?? r.endsAt
  const markets = r.audience?.marketIds.length ?? 0

  return (
    <SettingsTableRow href={routes.rollouts.detail(r.id)}>
      <SettingsTableCell>
        <Link
          href={routes.rollouts.detail(r.id)}
          className="truncate font-semibold text-ink-strong hover:underline focus-visible:underline focus-visible:outline-none"
        >
          {r.name}
        </Link>
      </SettingsTableCell>
      <SettingsTableCell>
        <RolloutStatusChip status={r.status} />
      </SettingsTableCell>
      <SettingsTableCell className="hidden text-muted-foreground sm:table-cell">
        {copy.kinds[r.kind]}
      </SettingsTableCell>
      <SettingsTableCell className="hidden tabular-nums text-muted-foreground md:table-cell">
        {start ? fmt.dateTime(start) : copy.notSet}
      </SettingsTableCell>
      <SettingsTableCell className="hidden tabular-nums text-muted-foreground md:table-cell">
        {end ? fmt.dateTime(end) : copy.notSet}
      </SettingsTableCell>
      <SettingsTableCell className="hidden text-muted-foreground lg:table-cell">
        <span className="flex items-center gap-1.5">
          <Globe className="size-4 shrink-0" aria-hidden="true" />
          {markets > 0 ? copy.audienceMarkets(markets) : copy.audienceAll}
        </span>
      </SettingsTableCell>
      <SettingsTableCell className="hidden text-muted-foreground xl:table-cell">
        {changesSummary(r, copy)}
      </SettingsTableCell>
    </SettingsTableRow>
  )
}
