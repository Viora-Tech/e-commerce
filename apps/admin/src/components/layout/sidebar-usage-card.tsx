'use client'

import Link from 'next/link'
import { navigationContent } from '@/data/navigation'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'
import { SIDEBAR_BLOCK } from '@/lib/sidebar-motion'

export type SidebarUsage = { used: number; limit: number; planName: string }

type SidebarUsageCardProps = {
  usage: SidebarUsage
}

/** "Orders this month · 142 of 1,000" with a thin bar and the plan nudge, above the user row. */
export default function SidebarUsageCard({ usage }: SidebarUsageCardProps) {
  // Hooks
  const copy = useCopy(navigationContent)
  const format = useFormat()

  // Render logic
  const percent = usage.limit > 0 ? Math.min(100, Math.round((usage.used / usage.limit) * 100)) : 0

  return (
    <div className={`flex flex-col gap-2 ${SIDEBAR_BLOCK}`}>
      <div className="flex flex-col gap-2 rounded-lg border border-hairline surface-card p-3">
        <p className="text-caption font-medium text-foreground">{copy.usage.title}</p>
        <div
          role="progressbar"
          aria-label={copy.usage.title}
          aria-valuemin={0}
          aria-valuemax={usage.limit}
          aria-valuenow={usage.used}
          className="h-1.5 overflow-hidden rounded-full bg-muted"
        >
          <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
        </div>
        <p className="text-caption text-muted-foreground tabular-nums">
          {copy.usage.of(format.number(usage.used), format.number(usage.limit))}
        </p>
      </div>
      <Link
        href={routes.settings.home()}
        className="rounded-md px-1 text-caption text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {copy.usage.moreRoom(usage.planName)}
      </Link>
    </div>
  )
}
