'use client'

import { HOME_METRICS, type HomeMetric } from '@commerce/core/home-metrics'
import { CheckIcon, Search, X } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { useState } from 'react'
import { homePageContent } from '@/data/home'
import { useCopy } from '@/hooks/use-copy'
import { METRIC_META } from './metric-meta'

type MetricPickerProps = {
  /** The metric in this slot now (ticked). */
  current: HomeMetric
  onPick: (metric: HomeMetric) => void
  onClose: () => void
}

/**
 * Figma 580:692 "Choose a metric for this slot": a search box over the fourteen metrics in two
 * columns, each with its icon; the slot's current metric is ticked.
 */
export default function MetricPicker({ current, onPick, onClose }: MetricPickerProps) {
  // Hooks
  const content = useCopy(homePageContent)
  const [query, setQuery] = useState('')

  // Render logic
  const copy = content.sales
  const q = query.trim().toLowerCase()
  const shown = HOME_METRICS.filter((m) => copy.metrics[m].toLowerCase().includes(q))

  return (
    <div className="flex w-[min(30rem,calc(100vw-2rem))] flex-col gap-2.5 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-body font-medium text-ink-strong">{copy.pickMetric}</p>
        <button
          type="button"
          onClick={onClose}
          aria-label={copy.cancel}
          className="flex size-7 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
      <label className="flex h-8 items-center gap-2 rounded-sm border border-input px-2.5 focus-within:ring-2 focus-within:ring-ring">
        <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <input
          // biome-ignore lint/a11y/noAutofocus: the picker opens to search.
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={copy.searchMetrics}
          aria-label={copy.searchMetrics}
          className="min-w-0 flex-1 bg-transparent text-body outline-none placeholder:text-muted-foreground"
        />
      </label>
      {shown.length === 0 ? (
        <p className="px-1 py-4 text-center text-body text-muted-foreground">{copy.noMetric}</p>
      ) : (
        <ul className="grid grid-cols-1 gap-0.5 sm:grid-cols-2">
          {shown.map((m) => {
            const { icon: Icon } = METRIC_META[m]
            return (
              <li key={m}>
                <button
                  type="button"
                  onClick={() => onPick(m)}
                  className={cn(
                    'flex h-8 w-full items-center gap-2 rounded-sm px-2 text-left text-body transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    m === current && 'bg-muted font-medium',
                  )}
                >
                  <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{copy.metrics[m]}</span>
                  {m === current ? (
                    <CheckIcon className="size-4 shrink-0" aria-hidden="true" />
                  ) : null}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
