'use client'

import { discoveryRate, type SearchQueryStat } from '@commerce/core/discovery'
import { SEARCH_ID } from '@commerce/plugin-search'
import { Button } from '@commerce/ui/shadcn/button'
import { TableCell, TableRow } from '@commerce/ui/shadcn/table'
import Link from 'next/link'
import EmptyState from '@/components/layout/empty-state'
import SimpleTable from '@/components/table/simple-table'
import { searchDiscoveryContent } from '@/data/search-discovery'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { formatRate } from '@/lib/analytics-range'
import { routes } from '@/lib/routes'

type Shortcut = 'synonym' | 'pin'

type SearchQueryTableProps = {
  rows: SearchQueryStat[]
  empty: string
  /** The fixes offered beside each search. */
  shortcuts: Shortcut[]
}

/** Where a shortcut opens: Synonyms with a new line, or Boosts with the pin dialog, for this search. */
export function shortcutHref(shortcut: Shortcut, query: string): string {
  const q = encodeURIComponent(query)
  return shortcut === 'synonym'
    ? `${routes.apps.page(SEARCH_ID, 'synonyms')}?add=${q}`
    : `${routes.apps.page(SEARCH_ID, 'boosts')}?pin=${q}`
}

/** A ranked list of searches with their counts and the "Add synonym" / "Pin a product" fixes. */
export default function SearchQueryTable({ rows, empty, shortcuts }: SearchQueryTableProps) {
  // Hooks
  const copy = useCopy(searchDiscoveryContent)
  const fmt = useFormat()

  // Early returns
  if (rows.length === 0) return <EmptyState variant="inline" body={empty} className="mx-5 my-6" />

  // Render logic
  const o = copy.overview
  const labels: Record<Shortcut, string> = { synonym: o.addSynonym, pin: o.pinProduct }

  return (
    <SimpleTable
      className="min-w-[44rem]"
      columns={[
        { key: 'search', label: o.columns.search },
        { key: 'searches', label: o.columns.searches, align: 'end', className: 'w-22' },
        { key: 'results', label: o.columns.results, align: 'end', className: 'w-20' },
        { key: 'rate', label: o.columns.clickRate, align: 'end', className: 'w-24' },
        { key: 'action', label: o.columns.action, align: 'end' },
      ]}
    >
      {rows.map((row) => (
        <TableRow key={row.query}>
          <TableCell className="max-w-0 min-w-40 font-medium">
            <span className="block truncate" title={row.query}>
              {row.query}
            </span>
          </TableCell>
          <TableCell className="text-right tabular-nums">{fmt.number(row.searches)}</TableCell>
          <TableCell className="text-right tabular-nums">{fmt.number(row.results)}</TableCell>
          <TableCell className="text-right tabular-nums">
            {formatRate(discoveryRate(row.clickedSessions, row.sessions))}
          </TableCell>
          <TableCell>
            <span className="flex justify-end gap-2">
              {shortcuts.map((s) => (
                <Button
                  key={s}
                  variant="outline"
                  size="sm"
                  nativeButton={false}
                  render={<Link href={shortcutHref(s, row.query)} />}
                >
                  {labels[s]}
                </Button>
              ))}
            </span>
          </TableCell>
        </TableRow>
      ))}
    </SimpleTable>
  )
}
