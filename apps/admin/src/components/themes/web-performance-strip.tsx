'use client'

import type { WebPerformance, WebVitalRating, WebVitalSummary } from '@commerce/core'
import StatusChip from '@/components/layout/status-chip'
import type { ChipTone } from '@/components/status/tone'
import { themesContent } from '@/data/themes'
import { useCopy } from '@/hooks/use-copy'

type WebPerformanceStripProps = {
  data: WebPerformance
}

const TONE: Record<WebVitalRating, ChipTone> = {
  good: 'success',
  'needs-work': 'attention',
  poor: 'danger',
}

/** 2.1 s, 180 ms, 0.04: each metric in the unit Google reports it in. */
function formatValue(metric: WebVitalSummary['metric'], value: number): string {
  if (metric === 'CLS') return value.toFixed(2)
  if (metric === 'LCP') return `${(value / 1000).toFixed(1)} s`
  return `${Math.round(value)} ms`
}

/**
 * Online store › Themes: real shoppers' page speed (Shopify's Web performance card). The p75 of
 * LCP, INP and CLS over 28 days, each with Google's Good / Needs work / Poor band, and page
 * loads by device. "Collecting data" until a metric has enough readings.
 */
export default function WebPerformanceStrip({ data }: WebPerformanceStripProps) {
  // Hooks
  const copy = useCopy(themesContent.performance)

  // Render logic
  const totalLoads = data.pageLoads.mobile + data.pageLoads.desktop
  const devices = [
    { key: 'mobile', label: copy.mobile, loads: data.pageLoads.mobile },
    { key: 'desktop', label: copy.desktop, loads: data.pageLoads.desktop },
  ]

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-border surface-card px-4 py-4 md:px-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h2 className="text-card-title">{copy.heading}</h2>
          <p className="text-[0.8125rem] leading-[1.1875rem] text-muted-foreground">
            {data.ready ? copy.body(data.windowDays) : copy.collectingBody}
          </p>
        </div>
        {data.ready ? null : <StatusChip tone="info">{copy.collecting}</StatusChip>}
      </div>
      <dl className="grid gap-3 sm:grid-cols-3">
        {data.metrics.map((m) => (
          <div
            key={m.metric}
            title={copy.hints[m.metric]}
            className="flex flex-col gap-1.5 rounded-xl border border-border px-3 py-3"
          >
            <dt className="text-caption text-muted-foreground">{copy.metrics[m.metric]}</dt>
            <dd className="flex flex-wrap items-center gap-2">
              <span className="text-[1.25rem] leading-7 font-semibold text-ink-strong tabular-nums">
                {m.p75 === null ? '—' : formatValue(m.metric, m.p75)}
              </span>
              {m.rating ? (
                <StatusChip tone={TONE[m.rating]}>{copy.ratings[m.rating]}</StatusChip>
              ) : (
                <span className="text-caption text-muted-foreground">{copy.collecting}</span>
              )}
            </dd>
            <dd className="text-caption text-muted-foreground tabular-nums">
              {copy.samples(m.samples)}
            </dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-col gap-2">
        <h3 className="text-body font-medium text-foreground">{copy.devices}</h3>
        <div className="flex h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
          {totalLoads > 0 ? (
            <>
              <span
                className="bg-primary"
                style={{ width: `${(data.pageLoads.mobile / totalLoads) * 100}%` }}
              />
              <span className="flex-1 bg-primary/40" />
            </>
          ) : null}
        </div>
        <ul className="flex flex-wrap gap-x-5 gap-y-1">
          {devices.map((d, i) => (
            <li key={d.key} className="flex items-center gap-2 text-caption text-muted-foreground">
              <span
                className={`size-2 rounded-full ${i === 0 ? 'bg-primary' : 'bg-primary/40'}`}
                aria-hidden="true"
              />
              <span className="text-foreground">{d.label}</span>
              <span className="tabular-nums">{copy.loads(d.loads)}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
