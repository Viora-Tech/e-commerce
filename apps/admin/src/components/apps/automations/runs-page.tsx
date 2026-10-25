'use client'

import { RUN_STATUSES, type RunStatus, type RunSummary } from '@commerce/core/automations'
import { Button } from '@commerce/ui/shadcn/button'
import { useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import EmptyState from '@/components/layout/empty-state'
import ResourceTable from '@/components/table/resource-table'
import ViewSelect from '@/components/table/view-select'
import {
  automationPiecesContent,
  automationRunStatusContent,
  automationsContent,
} from '@/data/automations'
import { useAutomationCatalogue } from '@/hooks/use-automation-catalogue'
import { useCopy, useLocale } from '@/hooks/use-copy'
import { automationApi } from '@/lib/automation-api'
import { triggerLabel } from '@/lib/automation-labels'
import { automationRoutes } from '@/lib/automation-routes'
import { runColumns } from './run-columns'

const PER_PAGE = 50

/** The list's filter from the URL: `?workflow=<id>` and/or `?recordType=order&recordId=<id>`. */
function filterOf(params: { get: (name: string) => string | null }): {
  workflowId?: string
  record?: { type: string; id: string }
} {
  const workflowId = params.get('workflow')
  const type = params.get('recordType')
  const id = params.get('recordId')
  return {
    ...(workflowId ? { workflowId } : {}),
    ...(type && id ? { record: { type, id } } : {}),
  }
}

/** Every run, newest first: status, workflow and trigger, the record it was about, when and how long. */
export default function RunsPage() {
  // Hooks
  const all = useCopy(automationsContent)
  const statuses = useCopy(automationRunStatusContent)
  const pieces = useCopy(automationPiecesContent)
  const locale = useLocale()
  const catalogue = useAutomationCatalogue()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<RunStatus | null>(null)
  const [runs, setRuns] = useState<RunSummary[] | null>(null)
  const [cursor, setCursor] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [loadingMore, setLoadingMore] = useState(false)

  useEffect(() => {
    let live = true
    setRuns(null)
    automationApi.runs
      .list({ ...filterOf(searchParams), ...(status ? { status } : {}) })
      .then((p) => {
        if (!live) return
        setRuns(p.runs)
        setCursor(p.nextCursor)
        setPage(1)
      })
      .catch(() => live && setFailed(true))
    return () => {
      live = false
    }
  }, [searchParams, status])

  // Helpers
  const triggerName = (id: string) =>
    triggerLabel(pieces, locale, catalogue?.triggers.find((t) => t.id === id) ?? null, id)

  // Event handlers
  const handleMore = async () => {
    if (!cursor) return
    setLoadingMore(true)
    try {
      const p = await automationApi.runs.list({
        ...filterOf(searchParams),
        ...(status ? { status } : {}),
        cursor,
      })
      setRuns((prev) => [...(prev ?? []), ...p.runs])
      setCursor(p.nextCursor)
    } finally {
      setLoadingMore(false)
    }
  }

  // Early returns
  if (failed) return <EmptyState variant="page" tone="danger" body={all.loadFailed} />

  // Render logic
  const copy = all.runs
  const q = query.trim().toLowerCase()
  const filtered = (runs ?? []).filter(
    (r) => !q || `${r.workflowName} ${r.subject.label}`.toLowerCase().includes(q),
  )

  return (
    <div className="flex flex-col gap-4">
      <ResourceTable
        resourceName={copy.resource}
        columns={runColumns(copy, triggerName)}
        items={filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE)}
        getId={(r) => r.id}
        href={(r) => automationRoutes.run(r.id)}
        loading={runs === null}
        query={query}
        onQueryChange={(next) => {
          setQuery(next)
          setPage(1)
        }}
        views={
          <ViewSelect
            value={status}
            label={copy.viewLabel}
            onChange={setStatus}
            options={[
              { value: null, label: copy.views.all },
              ...RUN_STATUSES.map((s) => ({ value: s, label: statuses.run[s] })),
            ]}
          />
        }
        page={page}
        perPage={PER_PAGE}
        total={filtered.length}
        onPageChange={setPage}
        selectable={false}
        empty={{ heading: copy.empty, body: copy.emptyBody }}
      />
      {cursor ? (
        <Button
          variant="outline"
          className="self-center"
          disabled={loadingMore}
          onClick={() => void handleMore()}
        >
          {copy.loadMore}
        </Button>
      ) : null}
    </div>
  )
}
