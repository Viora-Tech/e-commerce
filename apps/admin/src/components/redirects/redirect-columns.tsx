import { ArrowRight } from '@commerce/ui/icons'
import type { ResourceColumnSpec } from '@/components/table/resource-table'
import type { RedirectListItem, redirectsContent } from '@/data/redirects'
import type { useFormat } from '@/hooks/use-copy'

/** Columns of the URL redirects list: path, target, where it came from and when it changed. */
export function redirectColumns(
  copy: typeof redirectsContent,
  fmt: ReturnType<typeof useFormat>,
): ResourceColumnSpec<RedirectListItem>[] {
  return [
    {
      id: 'path',
      title: copy.columns.path,
      hideable: false,
      render: (r) => <span className="font-medium break-all text-ink-strong">{r.path}</span>,
    },
    {
      id: 'target',
      title: copy.columns.target,
      render: (r) => (
        <span className="flex items-center gap-2 break-all text-muted-foreground">
          <ArrowRight className="size-3.5 shrink-0" aria-hidden="true" />
          {r.target}
        </span>
      ),
    },
    {
      id: 'source',
      title: copy.columns.source,
      render: (r) => <span className="text-muted-foreground">{copy.source[r.source]}</span>,
    },
    {
      id: 'updated',
      title: copy.columns.updated,
      align: 'end',
      render: (r) => <span className="text-muted-foreground">{fmt.when(r.updatedAt)}</span>,
    },
  ]
}
