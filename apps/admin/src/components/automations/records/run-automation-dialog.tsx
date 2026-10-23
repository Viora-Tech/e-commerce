'use client'

import { MAX_MANUAL_RECORDS, type ManualWorkflow } from '@commerce/core/automations'
import { Search, Workflow } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { Input } from '@commerce/ui/shadcn/input'
import { Spinner } from '@commerce/ui/shadcn/spinner'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import EmptyState from '@/components/layout/empty-state'
import FormDialog from '@/components/layout/form-dialog'
import { type AutomationRecordType, automationRecordsContent } from '@/data/automation-records'
import { useCopy, useLocale } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { formatAgo } from '@/lib/format-date'
import { routes } from '@/lib/routes'

type RunAutomationDialogProps = {
  subjectType: AutomationRecordType
  /** The records to run on; null keeps the dialog closed. */
  ids: string[] | null
  onClose: () => void
  /** After runs were queued (a list clears its selection). */
  onDone?: (() => void) | undefined
}

const matches = (w: ManualWorkflow, query: string) =>
  w.name.toLowerCase().includes(query.trim().toLowerCase())

/**
 * "Run automation" on one record or a selection, Shopify Flow style: lists the On workflows
 * that start with this record type's "Run manually" trigger, runs the picked one through
 * `automations.runNow` (one run per record, keyed by a request id so a double click starts
 * nothing twice) and toasts how many started, with a link to the runs.
 */
export default function RunAutomationDialog({
  subjectType,
  ids,
  onClose,
  onDone,
}: RunAutomationDialogProps) {
  // Hooks
  const copy = useCopy(automationRecordsContent)
  const locale = useLocale()
  const router = useRouter()
  const [workflows, setWorkflows] = useState<ManualWorkflow[] | null>(null)
  const [query, setQuery] = useState('')
  const [picked, setPicked] = useState<string | null>(null)
  const [requestId, setRequestId] = useState(() => crypto.randomUUID())
  useEffect(() => {
    if (ids === null) return
    let live = true
    setWorkflows(null)
    setPicked(null)
    setQuery('')
    setRequestId(crypto.randomUUID())
    api.automations
      .listManual({ subjectType })
      .then((rows) => {
        if (!live) return
        setWorkflows(rows)
        const first = rows.find((w) => w.allowed)
        if (rows.length === 1 && first) setPicked(first.id)
      })
      .catch(() => {
        if (live) setWorkflows([])
      })
    return () => {
      live = false
    }
  }, [ids, subjectType])

  // Event handlers
  const handleSubmit = async () => {
    if (!ids || !picked) return
    if (ids.length > MAX_MANUAL_RECORDS) {
      toast.error(copy.dialog.tooMany(MAX_MANUAL_RECORDS))
      return
    }
    try {
      const r = await api.automations.runNow({ workflowId: picked, subjectType, ids, requestId })
      toast.success(copy.dialog.started(r.started, r.skipped), {
        action: {
          label: copy.dialog.viewRuns,
          onClick: () =>
            router.push(
              `${routes.apps.page('automations', 'runs')}?workflow=${encodeURIComponent(picked)}`,
            ),
        },
      })
      onClose()
      onDone?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.dialog.failed)
      throw err
    }
  }

  // Render logic
  const open = ids !== null
  const count = ids?.length ?? 0
  const shown = (workflows ?? []).filter((w) => matches(w, query))
  const selected = workflows?.find((w) => w.id === picked)

  return (
    <FormDialog
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={copy.dialog.title}
      description={copy.dialog.description(count, copy.nouns[subjectType])}
      submitLabel={copy.dialog.submit}
      submitDisabled={!selected?.allowed}
      onSubmit={handleSubmit}
      size="lg"
      stopPropagation
    >
      {workflows === null ? (
        <p className="flex items-center gap-2 py-6 text-body text-muted-foreground">
          <Spinner className="size-4" />
          {copy.dialog.loading}
        </p>
      ) : workflows.length === 0 ? (
        <EmptyState
          variant="inline"
          icon={Workflow}
          heading={copy.dialog.empty}
          body={copy.dialog.emptyBody}
          action={
            <Link
              href={routes.apps.page('automations')}
              className="text-body font-medium text-primary hover:underline"
            >
              {copy.dialog.openApp}
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={copy.dialog.search}
              aria-label={copy.dialog.search}
              className="pl-8"
            />
          </div>
          <fieldset
            aria-label={copy.dialog.title}
            className="flex max-h-80 flex-col gap-1.5 overflow-y-auto overscroll-contain"
          >
            {shown.length === 0 ? (
              <p className="py-4 text-body text-muted-foreground">{copy.dialog.noMatch}</p>
            ) : null}
            {shown.map((w) => {
              const asks = w.actions.filter((a) => a.needsApproval).length
              const meta = [
                copy.dialog.steps(w.actions.length),
                asks > 0 ? copy.dialog.asks(asks) : null,
                w.lastRunAt
                  ? copy.dialog.lastRun(formatAgo(w.lastRunAt, new Date(), locale))
                  : copy.dialog.neverRun,
              ].filter(Boolean)
              return (
                <label
                  key={w.id}
                  className={cn(
                    'flex items-start gap-3 rounded-lg border border-border p-3 transition-[background-color,border-color] has-focus-visible:ring-2 has-focus-visible:ring-ring',
                    w.allowed ? 'cursor-pointer' : 'cursor-not-allowed opacity-60',
                    picked === w.id ? 'border-primary bg-muted' : 'hover:bg-muted',
                  )}
                >
                  <input
                    type="radio"
                    name="run-automation-workflow"
                    value={w.id}
                    checked={picked === w.id}
                    disabled={!w.allowed}
                    onChange={() => setPicked(w.id)}
                    className="sr-only"
                  />
                  <Workflow aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-body font-medium">{w.name}</span>
                    <span className="text-caption text-muted-foreground">{meta.join(' · ')}</span>
                    {w.allowed ? null : (
                      <span className="text-caption text-muted-foreground">
                        {copy.dialog.notAllowed}
                      </span>
                    )}
                  </span>
                </label>
              )
            })}
          </fieldset>
        </div>
      )}
    </FormDialog>
  )
}
