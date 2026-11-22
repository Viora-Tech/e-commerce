import { ArrowRight } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import type { ResourceColumnSpec } from '@/components/table/resource-table'
import type { BrokenLinkListItem, brokenLinksContent } from '@/data/broken-links'
import type { useFormat } from '@/hooks/use-copy'

type BrokenLinkColumnsInput = {
  copy: typeof brokenLinksContent
  fmt: ReturnType<typeof useFormat>
  /** The row whose redirect is being created, so its button shows a spinner. */
  busyId: string | null
  onCreate: (item: BrokenLinkListItem) => void
  onChoose: (item: BrokenLinkListItem) => void
}

/** Columns of the Broken links view: the path (and where visitors came from), visits, last seen
 *  and the suggested target with its one-click Create redirect. */
export function brokenLinkColumns({
  copy,
  fmt,
  busyId,
  onCreate,
  onChoose,
}: BrokenLinkColumnsInput): ResourceColumnSpec<BrokenLinkListItem>[] {
  return [
    {
      id: 'path',
      title: copy.columns.path,
      hideable: false,
      className: 'w-[36%]',
      minWidth: 12,
      render: (r) => (
        <span className="flex min-w-0 flex-col">
          <span className="truncate font-medium text-ink-strong" title={r.path}>
            {r.path}
          </span>
          {r.referrer ? (
            <span className="truncate text-muted-foreground" title={r.referrer}>
              {copy.from(r.referrer)}
            </span>
          ) : null}
        </span>
      ),
    },
    {
      id: 'hits',
      title: copy.columns.hits,
      align: 'end',
      minWidth: 6,
      render: (r) => <span className="tabular-nums">{fmt.number(r.hits)}</span>,
    },
    {
      id: 'lastSeen',
      title: copy.columns.lastSeen,
      minWidth: 8,
      render: (r) => <span className="text-muted-foreground">{fmt.when(r.lastSeen)}</span>,
    },
    {
      id: 'suggestion',
      title: copy.columns.suggestion,
      className: 'w-[34%]',
      minWidth: 14,
      render: (r) => (
        <span className="flex min-w-0 items-center gap-2">
          {r.suggestion ? (
            <>
              <ArrowRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate" title={r.suggestion.target}>
                {r.suggestion.target}
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                loading={busyId === r.id}
                disabled={busyId !== null}
                onClick={(e) => {
                  e.stopPropagation()
                  onCreate(r)
                }}
              >
                {copy.create}
              </Button>
            </>
          ) : (
            <>
              <span className="min-w-0 flex-1 truncate text-muted-foreground">
                {copy.noSuggestion}
              </span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={(e) => {
                  e.stopPropagation()
                  onChoose(r)
                }}
              >
                {copy.choose}
              </Button>
            </>
          )}
        </span>
      ),
    },
  ]
}
