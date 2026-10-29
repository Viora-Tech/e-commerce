'use client'

import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { useEffect, useState } from 'react'
import type { AppPageProps } from '@/apps/registry'
import PageHeader from '@/components/layout/page-header'
import BackgroundWorkNotice from '@/components/media/background-work-notice'
import { shopifyImportContent } from '@/data/shopify-import'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import RunFilesCard from './run-files-card'
import RunHeaderCard from './run-header-card'
import RunHealthCard from './run-health-card'
import RunIssuesCard from './run-issues-card'
import RunLeftCard from './run-left-card'
import RunPreflight from './run-preflight'
import RunSamplesCard from './run-samples-card'
import RunStatTiles from './run-stat-tiles'
import RunTypeGrid from './run-type-grid'
import type { RunDetail } from './types'

const base = shopifyImportContent.base
const POLL_MS = 2000

/** Runs that will not move again until someone starts them. */
const ENDED = new Set<RunDetail['status']>(['completed', 'failed', 'cancelled'])

function message(
  copy: (typeof shopifyImportContent)['run'],
  run: RunDetail,
  when: (iso: string | Date) => string,
): string {
  if (run.stopRequestedAt && (run.status === 'queued' || run.status === 'running')) {
    return copy.stopping
  }
  if (run.status === 'queued') return copy.waiting
  if (run.status === 'running') return copy.running
  if (run.status === 'failed') return run.error ? `${copy.failed} ${run.error}` : copy.failed
  if (run.status === 'cancelled') {
    const at = run.finishedAt ?? run.stopRequestedAt ?? run.updatedAt
    return `${copy.stopped(run.stoppedBy, when(at))} ${copy.stoppedKeeps}`
  }
  return run.dryRun ? copy.previewDone : copy.importDone
}

/** One import: live progress while it runs, then counts, a sample and every problem. */
export default function RunPage({ params }: AppPageProps) {
  // Hooks
  const copy = useCopy(shopifyImportContent.run)
  const home = useCopy(shopifyImportContent.home)
  const fmt = useFormat()
  const [run, setRun] = useState<RunDetail | null | undefined>(undefined)

  // Poll while queued or running; Import now sets `queued`, which starts it again.
  useEffect(() => {
    if (run?.status && ENDED.has(run.status)) return
    let live = true
    let timer: ReturnType<typeof setTimeout> | undefined
    const load = async () => {
      const next = await api.shopifyImport.run({ id: params.id ?? '' }).catch(() => null)
      if (!live) return
      setRun(next)
      if (next && (next.status === 'queued' || next.status === 'running')) {
        timer = setTimeout(load, POLL_MS)
      }
    }
    load()
    return () => {
      live = false
      if (timer) clearTimeout(timer)
    }
  }, [params.id, run?.status])

  // Event handlers
  const handleQueued = () =>
    setRun((current) => (current ? { ...current, status: 'queued', dryRun: false } : current))

  const handleStopped = () =>
    setRun((current) =>
      current ? { ...current, stopRequestedAt: current.stopRequestedAt ?? new Date() } : current,
    )

  // Early returns
  const back = { label: copy.back, href: base }
  if (run === undefined) return <Skeleton className="h-64 w-full" />
  if (run === null) {
    return <PageHeader title={copy.notFound} back={back} />
  }

  // Render logic
  const previewDone = run.dryRun && run.status === 'completed'
  // A real import that finished: check what it left (Store health).
  const importDone = !run.dryRun && run.status === 'completed'
  const source = run.mode === 'csv' ? home.source.csv(run.fileName) : home.source.api
  const reuse = run.snapshotUse
    ? copy.usingPreview(fmt.dateTime(run.snapshotUse.takenAt), run.snapshotUse.changes)
    : run.dryRun && run.status === 'completed' && run.snapshot
      ? copy.previewReuse
      : null

  const notes = [
    reuse,
    run.retryOf ? copy.retrying : null,
    run.onlyMissing ? copy.remainingRun : null,
  ].filter((n): n is string => Boolean(n))

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={copy.title(run.dryRun)} subtitle={copy.from(source)} back={back} />
      <BackgroundWorkNotice />
      <RunHeaderCard
        run={run}
        message={message(copy, run, fmt.dateTime)}
        notes={notes}
        onQueued={handleQueued}
        onStopped={handleStopped}
      />
      <RunStatTiles run={run} />
      {importDone ? <RunHealthCard key={String(run.updatedAt)} /> : null}
      {previewDone ? <RunPreflight resources={run.resources} mode={run.mode} /> : null}
      <RunTypeGrid run={run} />
      <RunFilesCard run={run} />
      <RunLeftCard run={run} />
      {run.dryRun && run.preview.length > 0 ? (
        <RunSamplesCard samples={run.preview} progress={run.progress} />
      ) : null}
      <RunIssuesCard
        runId={run.id}
        count={run.issueCount}
        retryable={run.dryRun ? 0 : run.retryable}
        version={`${run.status}-${run.updatedAt}`}
      />
    </div>
  )
}
