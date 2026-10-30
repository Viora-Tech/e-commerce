'use client'

import type { RolloutHold } from '@commerce/core'
import Link from 'next/link'
import StatusChip from '@/components/layout/status-chip'
import { rolloutsContent } from '@/data/rollouts'
import { useCopy } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'

type RolloutHoldChipProps = {
  /** The unended rollout that will change this theme, discount or the checkout; none hides it. */
  hold: RolloutHold | null | undefined
}

/** "In rollout: Diwali sale", linking to that rollout. */
export default function RolloutHoldChip({ hold }: RolloutHoldChipProps) {
  // Hooks
  const copy = useCopy(rolloutsContent)

  // Early returns
  if (!hold) return null

  return (
    <Link
      href={routes.rollouts.detail(hold.id)}
      onClick={(e) => e.stopPropagation()}
      className="rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <StatusChip tone="violet">{copy.hold(hold.name)}</StatusChip>
    </Link>
  )
}
