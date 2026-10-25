'use client'

import { cn } from '@commerce/ui/lib/utils'
import { installedAppsContent } from '@/data/installed-apps'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { APP_STATUSES, type AppStatus } from '@/lib/app-access'

type StatusPillsProps = {
  value: AppStatus | null
  counts: Record<AppStatus, number>
  total: number
  onChange: (value: AppStatus | null) => void
}

/** Figma "Status filters": All / Connected / Needs setup / Error pills, each with its count. */
export default function StatusPills({ value, counts, total, onChange }: StatusPillsProps) {
  // Hooks
  const copy = useCopy(installedAppsContent)
  const fmt = useFormat()

  // Render logic
  const pills: { value: AppStatus | null; label: string; count: number }[] = [
    { value: null, label: copy.tabs.all, count: total },
    ...APP_STATUSES.map((s) => ({ value: s, label: copy.tabs[s], count: counts[s] })),
  ]

  return (
    <div className="flex flex-wrap gap-1.5">
      {pills.map((pill) => (
        <button
          key={pill.value ?? 'all'}
          type="button"
          aria-pressed={value === pill.value}
          onClick={() => onChange(pill.value)}
          className={cn(
            'flex h-[1.875rem] items-center gap-1.5 rounded-full border px-3 text-body transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            value === pill.value
              ? 'border-foreground bg-foreground text-background'
              : 'border-border text-foreground hover:bg-muted',
          )}
        >
          {pill.label}
          <span
            className={cn(
              'text-caption tabular-nums',
              value === pill.value ? 'opacity-70' : 'text-muted-foreground',
            )}
          >
            {fmt.number(pill.count)}
          </span>
        </button>
      ))}
    </div>
  )
}
