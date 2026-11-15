'use client'

import PillTabs from '@/components/layout/pill-tabs'
import { installedAppsContent } from '@/data/installed-apps'
import { useCopy } from '@/hooks/use-copy'
import { APP_STATUSES, type AppStatus } from '@/lib/app-access'

type StatusPillsProps = {
  value: AppStatus | null
  counts: Record<AppStatus, number>
  total: number
  onChange: (value: AppStatus | null) => void
}

/**
 * Figma "Status filters": All / Connected / Needs setup / Error, each with its count, on the one
 * PillTabs strip every list uses (was its own rounded pill buttons).
 */
export default function StatusPills({ value, counts, total, onChange }: StatusPillsProps) {
  // Hooks
  const copy = useCopy(installedAppsContent)

  // Render logic
  return (
    <PillTabs<AppStatus | null>
      label={copy.title}
      value={value}
      onChange={onChange}
      tabs={[
        { value: null, label: copy.tabs.all, count: total },
        ...APP_STATUSES.map((s) => ({ value: s, label: copy.tabs[s], count: counts[s] })),
      ]}
    />
  )
}
