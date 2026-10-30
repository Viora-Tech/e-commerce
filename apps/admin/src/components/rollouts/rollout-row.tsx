'use client'

import type { RolloutView } from '@commerce/core'
import Link from 'next/link'
import SettingsTableCell from '@/components/settings/settings-table-cell'
import SettingsTableRow from '@/components/settings/settings-table-row'
import { rolloutsContent } from '@/data/rollouts'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'
import { changesSummary, whenLabel } from './rollout-form-state'
import RolloutStatusChip from './rollout-status-chip'

type RolloutRowProps = {
  rollout: RolloutView
}

/** One rollout: its name and type, what it changes, when it runs and its status. */
export default function RolloutRow({ rollout: r }: RolloutRowProps) {
  // Hooks
  const copy = useCopy(rolloutsContent)
  const fmt = useFormat()

  return (
    <SettingsTableRow>
      <SettingsTableCell>
        <div className="flex min-w-0 flex-col">
          <Link
            href={routes.rollouts.detail(r.id)}
            className="truncate font-semibold text-ink-strong hover:underline focus-visible:underline focus-visible:outline-none"
          >
            {r.name}
          </Link>
          <span className="truncate text-caption text-muted-foreground">{copy.kinds[r.kind]}</span>
        </div>
      </SettingsTableCell>
      <SettingsTableCell className="hidden text-muted-foreground sm:table-cell">
        {changesSummary(r, copy)}
      </SettingsTableCell>
      <SettingsTableCell className="hidden tabular-nums text-muted-foreground md:table-cell">
        {whenLabel(r, copy, fmt)}
      </SettingsTableCell>
      <SettingsTableCell center>
        <RolloutStatusChip status={r.status} />
      </SettingsTableCell>
    </SettingsTableRow>
  )
}
