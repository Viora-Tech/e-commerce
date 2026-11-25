'use client'

import type { LoyaltySetupData } from '@/components/apps/loyalty/setup-state'
import StatusChip from '@/components/layout/status-chip'
import { loyaltyContent } from '@/data/loyalty'
import { useCopy } from '@/hooks/use-copy'
import { LOYALTY_PLACEMENTS } from '@/lib/loyalty-placements'

type LoyaltyStatusChipsProps = {
  setup: LoyaltySetupData
}

/** The app blocks the storefront offers (product page, product card, cart). */
const BLOCKS = LOYALTY_PLACEMENTS.filter((p) => p.kind === 'block').length

/**
 * Home's status row, as Essential Loyalty: how many app blocks the app offers, whether the
 * floating widget's app embed is on in the live theme (left out when the theme read failed),
 * and whether the program is live or paused.
 */
export default function LoyaltyStatusChips({ setup }: LoyaltyStatusChipsProps) {
  // Hooks
  const copy = useCopy(loyaltyContent)

  // Render logic
  const o = copy.overview
  const live = setup.settings.programStatus === 'live'

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span title={o.appBlocksHelp}>
        <StatusChip tone="success" variant="outline">
          {o.appBlocks(BLOCKS)}
        </StatusChip>
      </span>
      {setup.theme === undefined ? null : (
        <span title={o.embedHelp}>
          <StatusChip tone={setup.placementsOn ? 'success' : 'attention'}>
            {setup.placementsOn ? o.embedOn : o.embedOff}
          </StatusChip>
        </span>
      )}
      <StatusChip tone={live ? 'success' : 'neutral'}>{live ? o.live : o.paused}</StatusChip>
    </div>
  )
}
