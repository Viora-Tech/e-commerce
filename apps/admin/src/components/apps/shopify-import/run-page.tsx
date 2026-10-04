'use client'

import { Button } from '@commerce/ui/shadcn/button'
import { Card, CardContent } from '@commerce/ui/shadcn/card'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { AppPageProps } from '@/apps/registry'
import PageHeader from '@/components/layout/page-header'
import { shopifyImportContent } from '@/data/shopify-import'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import RunIssuesCard from './run-issues-card'
import RunLeftCard from './run-left-card'
import RunProgressCard from './run-progress-card'
import RunSamplesCard from './run-samples-card'
import RunStatusLabel from './run-status-label'
import type { RunDetail } from './types'

const base = shopifyImportContent.base
const POLL_MS = 2000

function message(copy: (typeof shopifyImportContent)['run'], run: RunDetail): string {
  if (run.status === 'queued') return copy.waiting
  if (run.status === 'running') return copy.running
  if (run.status === 'failed') return run.error ? `${copy.failed} ${run.error}` : copy.failed
  return run.dryRun ? copy.previewDone : copy.importDone
}

/** One import: live progress while it runs, then counts, a sample and every problem. */
export default function RunPage({ params }: AppPageProps) {
  // Hooks
  const copy = useCopy(shopifyImportContent.run)
  const home = useCopy(shopifyImportContent.home)
  const fmt = useFormat()
  const [run, setRun] = useState<RunDetail | null | undefined>(undefined)
  const [busy, setBusy] = useState(false)

  // Poll while queued or running; Import now sets `queued`, which starts it again.
  useEffect(() => {
    if (run?.status === 'completed' || run?.status === 'failed') return
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
  const handleStart = async () => {
    setBusy(true)
    try {
      await api.shopifyImport.start({ id: params.id ?? '' })
      toast.success(copy.started)
      setRun((current) => (current ? { ...current, status: 'queued', dryRun: false } : current))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.startFailed)
    } finally {
      setBusy(false)
    }
  }

  // Early returns
  const crumbs = [{ label: copy.back, href: base }]
  if (run === undefined) return <Skeleton className="h-64 w-full" />
  if (run === null) {
    return <PageHeader title={copy.notFound} breadcrumbs={crumbs} />
  }

  // Render logic
  const finished = run.status === 'completed' || run.status === 'failed'
  const action = !finished
    ? null
    : run.status === 'failed'
      ? copy.tryAgain
      : run.dryRun
        ? copy.importNow
        : copy.runAgain
  const source = run.mode === 'csv' ? home.source.csv(run.fileName) : home.source.api
  const reuse = run.snapshotUse
    ? copy.usingPreview(fmt.dateTime(run.snapshotUse.takenAt), run.snapshotUse.changes)
    : run.dryRun && run.status === 'completed' && run.snapshot
      ? copy.previewReuse
      : null

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={copy.title(run.dryRun)}
        subtitle={copy.from(source)}
        breadcrumbs={crumbs}
        actions={
          action ? (
            <Button type="button" onClick={handleStart} disabled={busy}>
              {busy ? <Spinner /> : null}
              {action}
            </Button>
          ) : null
        }
      />
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3">
          <RunStatusLabel status={run.status} preview={run.dryRun} />
          {finished ? null : <Spinner className="size-4 text-muted-foreground" />}
          <p className="text-body text-muted-foreground">{message(copy, run)}</p>
          {reuse ? <p className="w-full text-body text-muted-foreground">{reuse}</p> : null}
        </CardContent>
      </Card>
      <RunProgressCard run={run} />
      <RunLeftCard run={run} />
      {run.dryRun && run.preview.length > 0 ? <RunSamplesCard samples={run.preview} /> : null}
      <RunIssuesCard
        runId={run.id}
        count={run.issueCount}
        version={`${run.status}-${run.updatedAt}`}
      />
    </div>
  )
}
