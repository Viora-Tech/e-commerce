'use client'

import { Search } from '@commerce/ui/icons'
import { Input } from '@commerce/ui/shadcn/input'
import { analyticsContent } from '@/data/analytics'
import { useCopy } from '@/hooks/use-copy'

type ReportQueryBarProps = {
  value: string
  onChange: (value: string) => void
}

/**
 * The query bar of the Reports home (Figma "Reports · AI query"). For now it finds reports by
 * title; reading a plain-words question into a report is a follow-up and is not built here.
 */
export default function ReportQueryBar({ value, onChange }: ReportQueryBarProps) {
  // Hooks
  const { reports } = useCopy(analyticsContent)

  // Render logic
  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-primary"
          aria-hidden
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={reports.ask.placeholder}
          aria-label={reports.ask.placeholder}
          className="h-12 rounded-lg bg-card pl-10 shadow-card"
        />
      </div>
      <p className="text-caption text-muted-foreground">{reports.ask.note}</p>
    </div>
  )
}
