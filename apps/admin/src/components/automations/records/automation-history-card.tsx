'use client'

import type { RecordHistoryItem, RunStatus } from '@commerce/core/automations'
import { Workflow } from '@commerce/ui/icons'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import DataCard from '@/components/layout/data-card'
import StatusChip from '@/components/layout/status-chip'
import type { ChipTone } from '@/components/status/tone'
import { type AutomationRecordType, automationRecordsContent } from '@/data/automation-records'
import { useCopy, useLocale } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { formatAgo } from '@/lib/format-date'
import { routes } from '@/lib/routes'

type AutomationHistoryCardProps = {
  type: AutomationRecordType
  id: string
}

/** How many runs the card lists; "View all" opens the runs page for the rest. */
const LIMIT = 5

const TONE: Record<RunStatus, ChipTone> = {
  queued: 'info',
  running: 'info',
  waiting: 'attention',
  awaiting_approval: 'attention',
  completed: 'success',
  failed: 'danger',
  cancelled: 'neutral',
  skipped: 'neutral',
  converted: 'success',
  stopped: 'neutral',
}

/**
 * "Automations" on an order, customer or product page: the latest runs about the record or
 * that changed it (`automations.history`), each with its workflow, when and status, linking
 * to the run. Says so when none ran, with a link to the app. Never fails the page.
 */
export default function AutomationHistoryCard({ type, id }: AutomationHistoryCardProps) {
  // Hooks
  const copy = useCopy(automationRecordsContent)
  const locale = useLocale()
  const [items, setItems] = useState<RecordHistoryItem[] | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let live = true
    api.automations
      .history({ type, id, limit: LIMIT })
      .then((rows) => {
        if (live) setItems(rows)
      })
      .catch(() => {
        if (live) setFailed(true)
      })
    return () => {
      live = false
    }
  }, [type, id])

  // Early returns
  if (!items && !failed) return null

  // Render logic
  const app = routes.apps.page('automations')
  const runsHref = `${routes.apps.page('automations', 'runs')}?recordType=${type}&recordId=${encodeURIComponent(id)}`
  const rows = items ?? []

  return (
    <DataCard
      title={copy.history.title}
      count={rows.length > 0 ? rows.length : undefined}
      action={
        <Link
          href={rows.length > 0 ? runsHref : app}
          className="text-caption text-muted-foreground hover:text-foreground"
        >
          {rows.length > 0 ? copy.history.viewAll : copy.history.openApp}
        </Link>
      }
    >
      <div className="flex flex-col gap-2">
        {failed ? <p className="text-body text-muted-foreground">{copy.history.error}</p> : null}
        {!failed && rows.length === 0 ? (
          <p className="text-body text-muted-foreground">
            {copy.history.empty(copy.nouns[type].one)}
          </p>
        ) : null}
        {rows.map((r) => (
          <Link
            key={r.runId}
            href={routes.apps.page('automations', 'runs', r.runId)}
            className="flex items-start gap-3 rounded-lg border border-border p-2.5 transition-colors hover:bg-muted"
          >
            <Workflow aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-body">{r.workflowName}</span>
              <span className="text-caption text-muted-foreground">
                {formatAgo(r.startedAt, new Date(), locale)}
                {r.role === 'changed' ? ` · ${copy.history.changed}` : ''}
              </span>
            </span>
            <StatusChip tone={TONE[r.status]}>{copy.statuses[r.status]}</StatusChip>
          </Link>
        ))}
      </div>
    </DataCard>
  )
}
