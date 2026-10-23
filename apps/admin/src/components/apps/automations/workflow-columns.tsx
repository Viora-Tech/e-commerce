import type { WorkflowSummary } from '@commerce/core/automations'
import RelativeTime from '@/components/layout/relative-time'
import StatusChip from '@/components/layout/status-chip'
import type { ResourceColumnSpec } from '@/components/table/resource-table'
import type { automationsContent } from '@/data/automations'

type Copy = (typeof automationsContent)['list']

export type WorkflowView = 'active' | 'paused' | 'drafts'

/** Active (on), Paused (off after a publish), Draft (never published). */
export function viewOf(w: WorkflowSummary): WorkflowView {
  if (w.status === 'on') return 'active'
  return w.publishedVersion === null ? 'drafts' : 'paused'
}

/** Columns of the workflows list. `triggerName` resolves a trigger id to words. */
export function workflowColumns(
  copy: Copy,
  triggerName: (id: string) => string,
  formatNumber: (n: number) => string,
): ResourceColumnSpec<WorkflowSummary>[] {
  return [
    {
      id: 'name',
      title: copy.columns.name,
      hideable: false,
      align: 'start',
      className: 'w-96 px-3 whitespace-normal',
      sortValue: (w) => w.name,
      render: (w) => (
        <span className="flex flex-col text-left">
          <span className="text-body-strong">{w.name}</span>
          <span className="flex flex-wrap items-center gap-x-2 text-caption text-muted-foreground">
            {w.origin === 'growth' ? <span>{copy.marketing}</span> : null}
            {w.hasDraft && w.publishedVersion !== null ? <span>{copy.unsaved}</span> : null}
          </span>
        </span>
      ),
    },
    {
      id: 'trigger',
      title: copy.columns.trigger,
      align: 'start',
      render: (w) => <span className="text-muted-foreground">{triggerName(w.triggerType)}</span>,
    },
    {
      id: 'status',
      title: copy.columns.status,
      render: (w) => {
        const view = viewOf(w)
        return (
          <StatusChip
            tone={view === 'active' ? 'success' : view === 'paused' ? 'attention' : 'neutral'}
            variant="dot"
          >
            {view === 'active'
              ? copy.status.on
              : view === 'paused'
                ? copy.status.paused
                : copy.status.draft}
          </StatusChip>
        )
      },
    },
    {
      id: 'lastRun',
      title: copy.columns.lastRun,
      sortValue: (w) => (w.lastRunAt ? new Date(w.lastRunAt).getTime() : 0),
      render: (w) =>
        w.lastRunAt ? (
          <RelativeTime value={w.lastRunAt} />
        ) : (
          <span className="text-muted-foreground">{copy.never}</span>
        ),
    },
    {
      id: 'runs',
      title: copy.columns.runs,
      align: 'end',
      sortValue: (w) => w.runsLast30Days,
      render: (w) => <span className="tabular-nums">{formatNumber(w.runsLast30Days)}</span>,
    },
    {
      id: 'errors',
      title: copy.columns.errors,
      align: 'end',
      sortValue: (w) => w.errorRuns30d,
      render: (w) =>
        w.problem ? (
          <span title={w.problem}>
            <StatusChip tone="danger">{copy.problem}</StatusChip>
          </span>
        ) : w.errorRuns30d > 0 ? (
          <span className="tabular-nums text-destructive">{formatNumber(w.errorRuns30d)}</span>
        ) : (
          <span className="text-muted-foreground">–</span>
        ),
    },
  ]
}
