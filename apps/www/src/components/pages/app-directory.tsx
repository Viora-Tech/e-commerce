'use client'

import Link from 'next/link'
import { useState } from 'react'
import { type AppCategory, appsContent as copy, STORE_APPS } from '@/data/apps'
import ChoiceChip from '../common/choice-chip'
import PageContainer from '../common/page-container'

type Filter = 'all' | AppCategory

/** The App Store grid: category chips, then one card per app linking to its page. */
export default function AppDirectory() {
  // Hooks
  const [filter, setFilter] = useState<Filter>('all')

  // Render logic
  const visible = STORE_APPS.filter((a) => filter === 'all' || a.category === filter)
  return (
    <PageContainer className="flex flex-col gap-10">
      <fieldset
        aria-label={copy.filterLabel}
        className="m-0 flex min-w-0 flex-wrap justify-center gap-2 border-0 p-0"
      >
        {copy.filters.map((item) => (
          <ChoiceChip
            key={item.key}
            label={item.label}
            selected={filter === item.key}
            onSelect={() => setFilter(item.key)}
          />
        ))}
      </fieldset>
      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((app) => (
          <li key={app.id}>
            <Link
              href={`/apps/${app.id}`}
              className="surface-card spotlight flex h-full flex-col gap-3 rounded-2xl p-5 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <span className="flex items-center gap-3">
                <span
                  aria-hidden
                  className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-sm font-semibold text-foreground"
                >
                  {app.name.slice(0, 2)}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-semibold text-foreground">{app.name}</span>
                  <span className="truncate text-xs text-muted-foreground">{copy.by(app.by)}</span>
                </span>
              </span>
              <span className="text-sm text-muted-foreground">{app.blurb}</span>
              <span className="mt-auto text-xs font-medium text-foreground">
                {app.pricing.kind === 'free'
                  ? copy.free
                  : copy.paid(app.pricing.perMonth, app.pricing.includedFrom)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </PageContainer>
  )
}
