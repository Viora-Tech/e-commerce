import StatusChip from '@/components/layout/status-chip'
import type { ResourceColumnSpec } from '@/components/table/resource-table'
import type { metaobjectListContent } from '@/data/metaobjects'
import type { useFormat } from '@/hooks/use-copy'
import type { DefinitionSummary } from './form-state'

type ListCopy = typeof metaobjectListContent

/** Columns of Content types: name (hidden chip), field and entry counts, last change. */
export const definitionColumns = (
  copy: ListCopy,
  fmt: ReturnType<typeof useFormat>,
): ResourceColumnSpec<DefinitionSummary>[] => [
  {
    id: 'name',
    title: copy.columns.type,
    sortValue: (d) => d.name,
    hideable: false,
    align: 'start',
    className: 'w-80 px-3 whitespace-normal',
    render: (d) => (
      <span className="flex flex-col text-left">
        <span className="flex items-center gap-2">
          <span className="text-ink-strong">{d.name}</span>
          {d.storefrontAccess ? null : <StatusChip>{copy.hidden}</StatusChip>}
        </span>
        <span className="text-caption text-muted-foreground">{d.type}</span>
      </span>
    ),
  },
  {
    id: 'fields',
    title: copy.columns.fields,
    sortValue: (d) => d.fields.length,
    render: (d) => copy.fieldCount(d.fields.length),
  },
  {
    id: 'entries',
    title: copy.columns.entries,
    sortValue: (d) => d.entries,
    render: (d) => <span className="tabular-nums">{copy.entryCount(d.entries)}</span>,
  },
  {
    id: 'updated',
    title: copy.columns.updated,
    sortValue: (d) => new Date(d.updatedAt),
    align: 'end',
    render: (d) => <span className="text-muted-foreground">{fmt.when(d.updatedAt)}</span>,
  },
]
