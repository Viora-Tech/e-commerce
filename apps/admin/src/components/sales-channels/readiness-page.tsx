'use client'

import {
  type CatalogReadiness,
  READINESS_PARTS,
  type ReadinessIssue,
  type ReadinessSeverity,
} from '@commerce/core/sales-channels'
import { AiIcon, RefreshCw } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import KitButton from '@/components/kit/kit-button'
import DataCard from '@/components/layout/data-card'
import EmptyState from '@/components/layout/empty-state'
import PageBody from '@/components/layout/page-body'
import PageHeader from '@/components/layout/page-header'
import ScoreRing from '@/components/layout/score-ring'
import StatusChip from '@/components/layout/status-chip'
import { salesChannelsContent } from '@/data/sales-channels'
import { useCopy } from '@/hooks/use-copy'
import { routes } from '@/lib/routes'
import { scoreBand } from '@/lib/score'
import IssueRow from './issue-row'

type ReadinessPageProps = {
  report: CatalogReadiness
  aiBulk: boolean
}

type Filter = 'all' | ReadinessSeverity

const FILTERS: readonly Filter[] = ['all', 'high', 'medium', 'low']
const PAGE = 30
/** Most products one Write with AI run takes (the API's BULK_MAX). */
const AI_RUN_MAX = 200
const BAND_TONE = { good: 'success', fair: 'attention', poor: 'danger' } as const

/** Where a by-hand fix happens. */
function fixHref(issue: ReadinessIssue): string {
  if (issue.kind === 'policy') return routes.settings.policy(issue.ref)
  return routes.products.detail(issue.ref)
}

/** Figma "Agentic sales · Catalog readiness": the AI-ready score, its parts, and what to fix. */
export default function ReadinessPage({ report, aiBulk }: ReadinessPageProps) {
  // Hooks
  const router = useRouter()
  const copy = useCopy(salesChannelsContent.readiness)
  const [filter, setFilter] = useState<Filter>('all')
  const [shown, setShown] = useState(PAGE)

  // Event handlers
  const handleFilter = (next: Filter) => {
    setFilter(next)
    setShown(PAGE)
  }
  const handleWrite = (ids: string[]) => {
    router.push(routes.products.bulkWrite({ ids, fields: ['description'], from: 'readiness' }))
  }

  // Helpers
  const detail = (i: ReadinessIssue) => {
    if (i.rule === 'short_description') return copy.rules.short_description(i.n ?? 0)
    if (i.rule === 'few_images') return copy.rules.few_images(i.n ?? 0)
    return copy.rules[i.rule]
  }
  const action = (i: ReadinessIssue) =>
    i.fix === 'ai' && aiBulk ? (
      <KitButton variant="chip" onClick={() => handleWrite([i.ref])}>
        <AiIcon />
        {copy.fixes.ai}
      </KitButton>
    ) : (
      <KitButton variant="pill" href={fixHref(i)}>
        {i.fix === 'ai' ? copy.fixes.attributes : copy.fixes[i.fix]}
      </KitButton>
    )

  // Render logic
  const band = scoreBand(report.score)
  const matching =
    filter === 'all' ? report.issues : report.issues.filter((i) => i.severity === filter)
  const visible = matching.slice(0, shown)
  const aiCount = Math.min(report.aiFixable.length, AI_RUN_MAX)

  return (
    <PageBody className="gap-6 md:pt-5 md:pb-8">
      <PageHeader
        title={copy.title}
        subtitle={copy.subtitle}
        back={{ label: salesChannelsContent.overview.title, href: routes.salesChannels.agentic() }}
        actions={
          <>
            <KitButton variant="secondary" onClick={() => router.refresh()}>
              <RefreshCw />
              {copy.checkAgain}
            </KitButton>
            {aiBulk && aiCount > 0 ? (
              <KitButton onClick={() => handleWrite(report.aiFixable.slice(0, AI_RUN_MAX))}>
                <AiIcon />
                {copy.fixWithAi(aiCount)}
              </KitButton>
            ) : null}
          </>
        }
      />
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <DataCard
            title={
              <span className="flex items-center gap-2">
                {copy.scoreLabel}
                <StatusChip tone={BAND_TONE[band]} variant="dot">
                  {copy.grade[band]}
                </StatusChip>
              </span>
            }
          >
            <div className="flex flex-col items-center gap-3 text-center">
              <ScoreRing score={report.score} caption={copy.outOf} />
              <p className="text-caption text-muted-foreground">
                {copy.scoreBody(report.products)}
              </p>
            </div>
            <dl className="mt-4 flex flex-col divide-y divide-border border-t border-border">
              {READINESS_PARTS.map((part) => (
                <div key={part} className="flex items-baseline gap-2 py-2.5 text-body">
                  <dt className="font-medium text-foreground">{copy.parts[part].label}</dt>
                  <span className="flex-1 truncate text-caption text-muted-foreground">
                    {copy.parts[part].hint}
                  </span>
                  <dd className="font-medium text-ink-strong tabular-nums">{report.parts[part]}</dd>
                </div>
              ))}
            </dl>
          </DataCard>
          <DataCard title={copy.readsHeading}>
            <ul className="flex list-disc flex-col gap-1.5 pl-4 text-body text-muted-foreground">
              {copy.reads.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </DataCard>
        </div>
        <DataCard title={copy.issuesHeading} count={report.issues.length} flush>
          <div className="flex flex-wrap gap-1.5 px-4 pb-3">
            {FILTERS.map((f) => {
              const n = f === 'all' ? report.issues.length : report.counts[f]
              return (
                <button
                  key={f}
                  type="button"
                  aria-pressed={filter === f}
                  onClick={() => handleFilter(f)}
                  className={cn(
                    'h-7 rounded-full border px-3 text-caption font-medium transition-colors',
                    filter === f
                      ? 'border-transparent bg-action text-action-foreground'
                      : 'border-input bg-card text-foreground hover:bg-muted/60',
                  )}
                >
                  {f === 'all' ? copy.all : copy.severity[f]}{' '}
                  <span className="tabular-nums opacity-70">{n}</span>
                </button>
              )
            })}
          </div>
          {visible.length === 0 ? (
            <EmptyState variant="plain" size="sm" body={copy.empty} />
          ) : (
            <ul className="divide-y divide-border border-t border-border">
              {visible.map((i) => (
                <IssueRow
                  key={i.id}
                  severity={i.severity}
                  severityLabel={copy.severity[i.severity]}
                  title={i.kind === 'policy' ? (copy.policyNames[i.ref] ?? i.title) : i.title}
                  kind={i.kind === 'policy' ? copy.policy : copy.product}
                  detail={detail(i)}
                  action={action(i)}
                />
              ))}
            </ul>
          )}
          {matching.length > visible.length ? (
            <div className="flex justify-end border-t border-border px-4 py-3">
              <KitButton variant="linkSm" onClick={() => setShown(shown + PAGE)}>
                {copy.more(Math.min(PAGE, matching.length - visible.length))}
              </KitButton>
            </div>
          ) : null}
          {!aiBulk && report.aiFixable.length > 0 ? (
            <p className="border-t border-border px-4 py-3 text-caption text-muted-foreground">
              {copy.aiOff}
            </p>
          ) : null}
        </DataCard>
      </div>
    </PageBody>
  )
}
