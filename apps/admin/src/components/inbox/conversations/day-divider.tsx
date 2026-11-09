'use client'

import { useLocale } from '@/hooks/use-copy'
import { formatDay } from '@/lib/format-date'

type DayDividerProps = {
  at: Date | string
}

/** "Today", "Yesterday" or the date, between messages from different days. */
export default function DayDivider({ at }: DayDividerProps) {
  // Hooks
  const locale = useLocale()

  // Render logic
  return (
    <div className="flex items-center gap-3 py-1 text-caption text-muted-foreground">
      <span aria-hidden="true" className="h-px flex-1 bg-hairline" />
      <span className="shrink-0">{formatDay(at, new Date(), locale)}</span>
      <span aria-hidden="true" className="h-px flex-1 bg-hairline" />
    </div>
  )
}
