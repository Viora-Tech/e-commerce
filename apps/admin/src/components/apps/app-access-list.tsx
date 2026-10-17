'use client'

import { installedAppsContent } from '@/data/installed-apps'
import { useCopy } from '@/hooks/use-copy'
import { resourceLabel } from '@/lib/app-access'
import type { AppSummary } from './app-card'

type AppAccessListProps = {
  app: AppSummary
}

/**
 * What an app declares it can reach (Figma permissions sheet, "What it can access"): one row per
 * resource with the app's reason and its level. Used by the sheet, the install flow and the listing.
 */
export default function AppAccessList({ app }: AppAccessListProps) {
  // Hooks
  const copy = useCopy(installedAppsContent)

  // Render logic
  return (
    <ul className="flex flex-col">
      {app.access.resources.map((r) => (
        <li
          key={r.resource}
          className="grid grid-cols-[minmax(0,6.5rem)_minmax(0,1fr)_auto] items-center gap-3 py-2"
        >
          <span className="text-body font-medium text-foreground">
            {resourceLabel(r.resource, copy)}
          </span>
          <span className="text-body text-muted-foreground">{r.why}</span>
          <span className="text-right text-body whitespace-nowrap text-foreground">
            {copy.levels[r.level]}
          </span>
        </li>
      ))}
    </ul>
  )
}
