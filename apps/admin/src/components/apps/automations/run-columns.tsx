import type { RunSummary } from '@commerce/core/automations'
import Link from 'next/link'
import RelativeTime from '@/components/layout/relative-time'
import StatusChip from '@/components/layout/status-chip'
import type { ResourceColumnSpec } from '@/components/table/resource-table'
import type { automationsContent } from '@/data/automations'
import { recordHref } from '@/lib/automation-routes'
import RunStatusChip from './run-status-chip'

type Copy = (typeof automationsContent)['runs']

/** "1.2 s", "3 min", "2 h" between two moments; null while still running. */
export function durationOf(run: Pick<RunSummary, 'startedAt' | 'finishedAt'>): string | null {
  if (!run.finishedAt) return null
  const ms = new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()
  if (ms < 1000) return `${Math.max(0, ms)} ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)} min`
  if (ms < 86_400_000) return `${Math.round(ms / 3_600_000)} h`
  return `${Math.round(ms / 86_400_000)} d`
}

/** Columns of the runs list. */
export function runColumns(
  copy: Copy,
  triggerName: (id: string) => string,
): ResourceColumnSpec<RunSummary>[] {
  return [
    {
      id: 'status',
      title: copy.columns.status,
      hideable: false,
      align: 'start',
      render: (r) => (
        <span className="flex items-center gap-1.5">
          <RunStatusChip status={r.status} />
          {r.isTest ? <StatusChip tone="violet">{copy.test}</StatusChip> : null}
        </span>
      ),
    },
    {
      id: 'workflow',
      title: copy.columns.workflow,
      align: 'start',
      className: 'whitespace-normal',
      render: (r) => (
        <span className="flex flex-col text-left">
          <span className="text-body-strong">{r.workflowName}</span>
          <span className="text-caption text-muted-foreground">
            {triggerName(r.triggerType)}
            {r.manual ? ` · ${copy.manual}` : ''}
          </span>
        </span>
      ),
    },
    {
      id: 'subject',
      title: copy.columns.subject,
      align: 'start',
      render: (r) => {
        const href = recordHref(r.subject.type, r.subject.id)
        return href ? (
          <Link
            href={href}
            onClick={(e) => e.stopPropagation()}
            className="font-medium text-ink-strong underline underline-offset-4"
          >
            {r.subject.label}
          </Link>
        ) : (
          <span className="text-muted-foreground">{r.subject.label || copy.noSubject}</span>
        )
      },
    },
    {
      id: 'started',
      title: copy.columns.started,
      sortValue: (r) => new Date(r.startedAt).getTime(),
      render: (r) => <RelativeTime value={r.startedAt} />,
    },
    {
      id: 'duration',
      title: copy.columns.duration,
      align: 'end',
      render: (r) => (
        <span className="text-muted-foreground tabular-nums">
          {durationOf(r) ?? copy.stillRunning}
        </span>
      ),
    },
  ]
}
