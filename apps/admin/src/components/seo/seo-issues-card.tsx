'use client'

import type { SeoIssue, SeoSeverity } from '@commerce/core'
import { cn } from '@commerce/ui/lib/utils'
import Link from 'next/link'
import { useState } from 'react'
import KitButton from '@/components/kit/kit-button'
import StatusChip from '@/components/layout/status-chip'
import SettingsCard from '@/components/settings/settings-card'
import { seoReportContent } from '@/data/seo-report'
import { useCopy } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'

type SeoIssuesCardProps = {
  issues: SeoIssue[]
}

type Filter = 'all' | SeoSeverity

const FILTERS: readonly Filter[] = ['all', 'high', 'medium', 'low']
const PAGE = 50

const SEVERITY_TONE = { high: 'danger', medium: 'attention', low: 'neutral' } as const

/** Where the merchant fixes an item by hand. */
function editHref(issue: SeoIssue): string {
  if (issue.resource === 'product') return routes.products.detail(issue.id)
  if (issue.resource === 'collection') return routes.products.collection(issue.id)
  if (issue.resource === 'menu') return routes.content.menu(issue.id)
  return routes.onlineStore.page(issue.id)
}

/** The issues, most important first, filterable by impact, 50 at a time. */
export default function SeoIssuesCard({ issues }: SeoIssuesCardProps) {
  // Hooks
  const copy = useCopy(seoReportContent.issues)
  const kinds = useCopy(seoReportContent.kinds)
  const [filter, setFilter] = useState<Filter>('all')
  const [shown, setShown] = useState(PAGE)

  // Event handlers
  const handleFilter = (next: Filter) => {
    setFilter(next)
    setShown(PAGE)
  }

  // Render logic
  const matching = filter === 'all' ? issues : issues.filter((i) => i.severity === filter)
  const visible = matching.slice(0, shown)
  const rest = matching.length - visible.length

  return (
    <SettingsCard title={copy.heading} description={copy.body}>
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={filter === f}
              onClick={() => handleFilter(f)}
              className={cn(
                'h-8 rounded-md border px-3 text-body font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                filter === f
                  ? 'border-border-strong bg-muted text-foreground'
                  : 'border-input bg-card text-muted-foreground hover:text-foreground',
              )}
            >
              {copy.filters[f]}
            </button>
          ))}
        </div>
        {matching.length === 0 ? (
          <p className="text-body text-muted-foreground">{copy.empty}</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
            {visible.map((issue) => (
              <li key={`${issue.kind}:${issue.id}`} className="flex items-start gap-3 px-3 py-2.5">
                <StatusChip tone={SEVERITY_TONE[issue.severity]}>
                  {copy.severity[issue.severity]}
                </StatusChip>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-body font-medium text-foreground">
                    {issue.title}
                    <span className="ml-2 text-caption font-normal text-muted-foreground">
                      {copy.resource[issue.resource]}
                    </span>
                  </span>
                  <span className="text-body text-muted-foreground">
                    {kinds[issue.kind](issue.detail)}
                  </span>
                </div>
                <Link
                  href={editHref(issue)}
                  className="shrink-0 text-body font-medium text-foreground underline-offset-4 hover:underline"
                >
                  {copy.edit}
                </Link>
              </li>
            ))}
          </ul>
        )}
        {rest > 0 ? (
          <KitButton
            variant="secondary"
            className="self-end"
            onClick={() => setShown((n) => n + PAGE)}
          >
            {copy.more(Math.min(rest, PAGE))}
          </KitButton>
        ) : null}
      </div>
    </SettingsCard>
  )
}
