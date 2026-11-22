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
      // Long handles truncate with the full path on hover, instead of running into Redirect to.
      className: 'w-[40%]',
      minWidth: 12,
      render: (r) => (
        <span className="block min-w-0 truncate font-medium text-ink-strong" title={r.path}>
          {r.path}
        </span>
      ),
    },
    {
      id: 'target',
      title: copy.columns.target,
      className: 'w-[36%]',
      minWidth: 10,
      render: (r) => (
        <span className="flex min-w-0 items-center gap-2 text-muted-foreground" title={r.target}>
          <ArrowRight className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="min-w-0 truncate">{r.target}</span>
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
