import { Button } from '@commerce/ui/shadcn/button'
import RelativeTime from '@/components/layout/relative-time'
import StatusChip from '@/components/layout/status-chip'
import type { ResourceColumnSpec } from '@/components/table/resource-table'
import type { activityLogContent } from '@/data/activity-log'
import type { api } from '@/lib/api-client'

export type ActivityRow = Awaited<ReturnType<typeof api.activityLog.list>>['rows'][number]

/** Columns of Settings → Activity log; the time opens the row's details. */
export function activityColumns(
  copy: typeof activityLogContent,
  onOpen: (row: ActivityRow) => void,
): ResourceColumnSpec<ActivityRow>[] {
  const c = copy.columns
  return [
    {
      id: 'when',
      title: c.when,
      align: 'start',
      hideable: false,
      render: (r) => (
        <Button variant="link" className="h-auto p-0" onClick={() => onOpen(r)}>
          <RelativeTime value={r.createdAt} />
        </Button>
      ),
    },
    {
      id: 'who',
      title: c.who,
      align: 'start',
      render: (r) => (
        <span className="flex min-w-0 flex-col">
          <span className="truncate">{r.actorName || r.actorEmail || copy.system}</span>
          {r.actorName && r.actorEmail ? (
            <span className="truncate text-caption text-muted-foreground">{r.actorEmail}</span>
          ) : null}
        </span>
      ),
    },
    {
      id: 'what',
      title: c.what,
      align: 'start',
      hideable: false,
      render: (r) => (
        <button
          type="button"
          className="min-w-0 max-w-[28rem] truncate text-left hover:underline"
          onClick={() => onOpen(r)}
        >
          {r.summary}
        </button>
      ),
    },
    { id: 'area', title: c.area, render: (r) => copy.areas[r.area] ?? r.area },
    {
      id: 'source',
      title: c.source,
      render: (r) => <StatusChip tone="neutral">{copy.sources[r.source] ?? r.source}</StatusChip>,
    },
  ]
}
