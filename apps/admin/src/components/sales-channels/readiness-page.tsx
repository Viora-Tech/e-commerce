'use client'

import {
  type CatalogReadiness,
  READINESS_PARTS,
  type ReadinessIssue,
  type ReadinessRule,
  type ReadinessSeverity,
} from '@commerce/core/sales-channels'
import { AiIcon, RefreshCw } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import DataCard from '@/components/layout/data-card'
import EmptyState from '@/components/layout/empty-state'
import PageBody from '@/components/layout/page-body'
import PageColumns from '@/components/layout/page-columns'
import PageHeader from '@/components/layout/page-header'
import PillTabs from '@/components/layout/pill-tabs'
import ScoreRing from '@/components/layout/score-ring'
import StatusChip from '@/components/layout/status-chip'
import { catalogReadinessContent } from '@/data/catalog-readiness'
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

/** Issues grouped by rule, biggest group first: one row per problem instead of one per product. */
function byRule(issues: readonly ReadinessIssue[]) {
  const groups = new Map<ReadinessRule, ReadinessIssue[]>()
  for (const i of issues) groups.set(i.rule, [...(groups.get(i.rule) ?? []), i])
  return [...groups.entries()]
    .map(([rule, items]) => ({ rule, items }))
    .sort((a, b) => b.items.length - a.items.length)
}

/**
 * Figma "Agentic sales · Catalog readiness": the AI-ready score, its parts, and what to fix,
 * first as one row per problem ("No description · 3 products", one fix for all; owner 18 Nov
 * 2026), then the products themselves, filtered by severity or by the problem picked.
 */
export default function ReadinessPage({ report, aiBulk }: ReadinessPageProps) {
  // Hooks
  const salesChannelsCopy = useCopy(salesChannelsContent)
  const router = useRouter()
  const copy = useCopy(salesChannelsContent.readiness)
  const groupCopy = useCopy(catalogReadinessContent)
  const [filter, setFilter] = useState<Filter>('all')
  const [rule, setRule] = useState<ReadinessRule | null>(null)
  const [shown, setShown] = useState(PAGE)

  // Event handlers
  const handleFilter = (next: Filter) => {
    setFilter(next)
    setRule(null)
    setShown(PAGE)
  }
  const handleRule = (next: ReadinessRule | null) => {
    setRule(next)
    setFilter('all')
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
      <Button variant="outline" size="sm" onClick={() => handleWrite([i.ref])}>
        <AiIcon />
        {copy.fixes.ai}
      </Button>
    ) : (
      <Button variant="outline" size="sm" nativeButton={false} render={<Link href={fixHref(i)} />}>
        {i.fix === 'ai' ? copy.fixes.attributes : copy.fixes[i.fix]}
      </Button>
    )

  // Render logic
  const band = scoreBand(report.score)
  const groups = byRule(report.issues)
  const matching = rule
    ? report.issues.filter((i) => i.rule === rule)
    : filter === 'all'
      ? report.issues
      : report.issues.filter((i) => i.severity === filter)
  const visible = matching.slice(0, shown)
  const aiCount = Math.min(report.aiFixable.length, AI_RUN_MAX)

  return (
    <PageBody>
      <PageHeader
        title={copy.title}
        subtitle={copy.subtitle}
        back={{ label: salesChannelsCopy.overview.title, href: routes.salesChannels.agentic() }}
        actions={
          <>
            <Button variant="outline" onClick={() => router.refresh()}>
              <RefreshCw />
              {copy.checkAgain}
            </Button>
            {aiBulk && aiCount > 0 ? (
              <Button onClick={() => handleWrite(report.aiFixable.slice(0, AI_RUN_MAX))}>
                <AiIcon />
                {copy.fixWithAi(aiCount)}
              </Button>
            ) : null}
          </>
        }
      />
      <PageColumns
        main={
          <>
            {groups.length > 1 ? (
              <DataCard title={groupCopy.heading} flush>
                <ul className="divide-y divide-border border-t border-border">
                  {groups.map((g) => {
                    const ids = g.items.filter((i) => i.fix === 'ai').map((i) => i.ref)
                    const allAi = aiBulk && ids.length === g.items.length
                    return (
                      <li key={g.rule} className="flex items-center gap-3 px-5 py-3">
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="text-body font-medium text-foreground">
                            {groupCopy.groups[g.rule]}
                          </span>
                          <span className="text-caption text-muted-foreground">
                            {groupCopy.products(g.items.length)}
                          </span>
                        </span>
                        {allAi ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleWrite(ids.slice(0, AI_RUN_MAX))}
                          >
                            <AiIcon />
                            {groupCopy.fixAll(Math.min(ids.length, AI_RUN_MAX))}
                          </Button>
                        ) : (
                          <Button variant="outline" size="sm" onClick={() => handleRule(g.rule)}>
                            {groupCopy.show}
                          </Button>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </DataCard>
            ) : null}
            <DataCard title={copy.issuesHeading} count={report.issues.length} flush>
              {rule ? (
                <div className="flex items-center justify-between gap-3 px-4 pb-3 text-body">
                  <span className="text-foreground">
                    {groupCopy.showing(groupCopy.groups[rule])}
                  </span>
                  <Button
                    variant="link"
                    size="xs"
                    className="h-auto px-0"
                    onClick={() => handleRule(null)}
                  >
                    {groupCopy.clear}
                  </Button>
                </div>
              ) : null}
              <PillTabs
                label={copy.issuesHeading}
                className="px-4 pb-3"
                tabs={FILTERS.map((f) => ({
                  value: f,
                  label: f === 'all' ? copy.all : copy.severity[f],
                  count: f === 'all' ? report.issues.length : report.counts[f],
                }))}
                value={filter}
                onChange={handleFilter}
              />
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
                  <Button
                    variant="link"
                    size="xs"
                    onClick={() => setShown(shown + PAGE)}
                    className="h-auto px-0"
                  >
                    {copy.more(Math.min(PAGE, matching.length - visible.length))}
                  </Button>
                </div>
              ) : null}
              {!aiBulk && report.aiFixable.length > 0 ? (
                <p className="border-t border-border px-4 py-3 text-caption text-muted-foreground">
                  {copy.aiOff}
                </p>
              ) : null}
            </DataCard>
          </>
        }
        side={
          <>
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
                    <dd className="font-medium text-ink-strong tabular-nums">
                      {report.parts[part]}
                    </dd>
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
          </>
        }
      />
    </PageBody>
  )
}
