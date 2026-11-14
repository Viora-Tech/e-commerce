'use client'

import type { NodeId, RunDetail, StepRunView } from '@commerce/core/automations'
import { permissions } from '@commerce/core/permissions'
import { ChevronLeftIcon, RotateCcw, X } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { Skeleton } from '@commerce/ui/shadcn/skeleton'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { AppPageProps } from '@/apps/registry'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import EmptyState from '@/components/layout/empty-state'
import RelativeTime from '@/components/layout/relative-time'
import StatusChip from '@/components/layout/status-chip'
import {
  automationEditorContent,
  automationPiecesContent,
  automationRunContent,
  automationRunStatusContent,
} from '@/data/automations'
import { useAutomationCatalogue } from '@/hooks/use-automation-catalogue'
import { useCopy, useLocale } from '@/hooks/use-copy'
import { usePermissions } from '@/hooks/use-permissions'
import { automationApi } from '@/lib/automation-api'
import { nodeView } from '@/lib/automation-node-view'
import { automationRoutes, recordHref } from '@/lib/automation-routes'
import type { NodeMark } from './canvas/types'
import WorkflowCanvas from './canvas/workflow-canvas'
import RunStatusChip from './run-status-chip'
import RunStepItem from './run-step-item'

const MARK: Record<StepRunView['status'], NodeMark> = {
  running: 'waiting',
  succeeded: 'ran',
  // biome-ignore lint/suspicious/noThenProperty: a run status the engine calls "then"
  then: 'ran',
  otherwise: 'ran',
  failed: 'failed',
  skipped: 'skipped',
  waiting: 'waiting',
  awaiting_approval: 'waiting',
  cancelled: 'skipped',
}

const noop = () => undefined

/** One run: the path it took drawn over the workflow, and each step's input, result, error and approval. */
export default function RunPage({ params }: AppPageProps) {
  // Hooks
  const copy = useCopy(automationRunContent)
  const statuses = useCopy(automationRunStatusContent)
  const editor = useCopy(automationEditorContent)
  const pieces = useCopy(automationPiecesContent)
  const locale = useLocale()
  const catalogue = useAutomationCatalogue()
  const { hasPermission } = usePermissions()
  const [run, setRun] = useState<RunDetail | null | undefined>(undefined)
  const [selected, setSelected] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const id = params.id
    if (!id) return
    let live = true
    automationApi.runs
      .get(id)
      .then((r) => live && setRun(r))
      .catch(() => live && setRun(null))
    return () => {
      live = false
    }
  }, [params.id])

  // Helpers
  const titleOf = (nodeId: string) => {
    const node = run?.definition.nodes[nodeId]
    return node && catalogue
      ? nodeView(node, { catalogue, pieces, locale, copy: editor }).title
      : nodeId
  }

  // Event handlers
  const handleRetry = async () => {
    if (!run) return
    setBusy(true)
    try {
      setRun(await automationApi.runs.retry(run.id))
      toast.success(copy.retried)
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }

  const handleCancel = async () => {
    if (!run) return
    try {
      setRun(await automationApi.runs.cancel(run.id))
      toast.success(copy.cancelled)
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : copy.failed)
      throw err
    }
  }

  // Early returns
  if (run === null) return <EmptyState variant="page" body={copy.notFound} />
  if (run === undefined || !catalogue) return <Skeleton className="h-[36rem] w-full" />

  // Render logic
  const marks: Record<NodeId, NodeMark> = Object.fromEntries(
    run.steps.map((s) => [s.nodeId, MARK[s.status]]),
  )
  const href = recordHref(run.subject.type, run.subject.id)
  const canAct = hasPermission(permissions.AUTOMATIONS_PUBLISH)
  const reason = run.stopReason ? (statuses.reasons[run.stopReason] ?? run.stopReason) : null
  const ordered = [...run.steps].sort(
    (a, b) => run.path.indexOf(a.nodeId) - run.path.indexOf(b.nodeId),
  )

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <Button
            variant="outline"
            size="icon"
            aria-label={copy.back}
            nativeButton={false}
            render={<Link href={automationRoutes.runs()} />}
          >
            <ChevronLeftIcon />
          </Button>
          <div className="flex min-w-0 flex-col gap-1">
            <h2 className="flex flex-wrap items-center gap-2 text-page-title text-ink-strong">
              {copy.title(run.workflowName)}
              <RunStatusChip status={run.status} variant="soft" />
              {run.isTest ? <StatusChip tone="violet">{copy.test}</StatusChip> : null}
            </h2>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-caption text-muted-foreground">
              <Link
                href={automationRoutes.workflow(run.workflowId)}
                className="underline underline-offset-4"
              >
                {copy.version(run.versionNumber)}
              </Link>
              <span>
                {copy.started} <RelativeTime value={run.startedAt} />
              </span>
              {run.finishedAt ? (
                <span>
                  {copy.finished} <RelativeTime value={run.finishedAt} />
                </span>
              ) : null}
              {run.nextAt ? (
                <span>
                  {copy.nextAt} <RelativeTime value={run.nextAt} />
                </span>
              ) : null}
              {href ? (
                <Link
                  href={href}
                  className="font-medium text-ink-strong underline underline-offset-4"
                >
                  {copy.record}: {run.subject.label}
                </Link>
              ) : null}
            </p>
            {reason || run.error ? (
              <p className="text-body text-danger">{run.error ?? reason}</p>
            ) : null}
          </div>
        </div>
        {canAct ? (
          <div className="flex gap-2">
            {run.canCancel ? (
              <Button variant="outline" onClick={() => setCancelling(true)}>
                <X aria-hidden="true" />
                {copy.cancel}
              </Button>
            ) : null}
            {run.canRetry ? (
              <Button loading={busy} disabled={busy} onClick={() => void handleRetry()}>
                <RotateCcw aria-hidden="true" />
                {copy.retry}
              </Button>
            ) : null}
          </div>
        ) : null}
      </header>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_26rem]">
        <WorkflowCanvas
          className="h-[32rem] rounded-xl border border-border bg-card lg:h-[calc(100dvh-14rem)]"
          ctx={{
            def: run.definition,
            catalogue,
            pieces,
            locale,
            copy: editor,
            selected,
            flagged: new Set(),
            marks,
            readOnly: true,
            onSelect: setSelected,
            onInsert: noop,
          }}
        />
        <section aria-label={copy.steps} className="flex flex-col gap-2">
          <h3 className="text-eyebrow text-muted-foreground">{copy.steps}</h3>
          <ol className="flex flex-col gap-2">
            {ordered.map((s) => (
              <RunStepItem
                key={s.id}
                step={s}
                title={titleOf(s.nodeId)}
                selected={selected === s.nodeId}
                onSelect={() => setSelected(selected === s.nodeId ? null : s.nodeId)}
              />
            ))}
          </ol>
        </section>
      </div>
      <ConfirmDialog
        tone="destructive"
        open={cancelling}
        onOpenChange={setCancelling}
        title={copy.cancelTitle}
        body={copy.cancelBody}
        confirmLabel={copy.cancel}
        onConfirm={handleCancel}
      />
    </div>
  )
}
