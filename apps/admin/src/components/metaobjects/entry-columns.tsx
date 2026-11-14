import StatusChip from '@/components/layout/status-chip'
import type { ResourceColumnSpec } from '@/components/table/resource-table'
import type { entryListContent } from '@/data/metaobjects'
import type { useFormat } from '@/hooks/use-copy'
import type { api } from '@/lib/api-client'

export type EntryRow = Awaited<ReturnType<typeof api.metaobjects.entries>>['rows'][number]

type ListCopy = typeof entryListContent

/** Columns of a content type's entries: name and handle, status, last change. */
export const entryColumns = (
  copy: ListCopy,
  fmt: ReturnType<typeof useFormat>,
): ResourceColumnSpec<EntryRow>[] => [
  {
    id: 'name',
    title: copy.columns.name,
    sortValue: (e) => e.displayName,
    hideable: false,
    align: 'start',
    className: 'w-96 px-3 whitespace-normal',
    render: (e) => (
      <span className="flex min-w-0 flex-col text-left">
        <span className="line-clamp-2 text-ink-strong">{e.displayName}</span>
        <span className="truncate text-caption text-muted-foreground">{e.handle}</span>
      </span>
    ),
  },
  {
    id: 'status',
    title: copy.columns.status,
    sortValue: (e) => e.status,
    align: 'center',
    render: (e) => (
      <StatusChip tone={e.status === 'active' ? 'success' : 'neutral'}>
        {copy.status[e.status]}
      </StatusChip>
    ),
  },
  {
    id: 'updated',
    title: copy.columns.updated,
    sortValue: (e) => new Date(e.updatedAt),
    align: 'end',
    render: (e) => <span className="text-muted-foreground">{fmt.when(e.updatedAt)}</span>,
  },
]
