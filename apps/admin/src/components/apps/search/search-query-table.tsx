'use client'

import { discoveryRate, type SearchQueryStat } from '@commerce/core/discovery'
import { SEARCH_ID } from '@commerce/plugin-search'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import KitTable from '@/components/kit/kit-table'
import KitTableHead from '@/components/kit/kit-table-head'
import KitTableRow from '@/components/kit/kit-table-row'
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

const COLUMNS = 'minmax(10rem,1fr) 5.5rem 5rem 6rem minmax(12rem,auto)'

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
  if (rows.length === 0) return <p className="px-5 py-6 text-body text-muted-foreground">{empty}</p>

  // Render logic
  const o = copy.overview
  const labels: Record<Shortcut, string> = { synonym: o.addSynonym, pin: o.pinProduct }

  return (
    <div className="overflow-x-auto">
      <KitTable className="min-w-[44rem]">
        <KitTableHead columns={COLUMNS}>
          <span>{o.columns.search}</span>
          <span className="justify-end">{o.columns.searches}</span>
          <span className="justify-end">{o.columns.results}</span>
          <span className="justify-end">{o.columns.clickRate}</span>
          <span className="justify-end">{o.columns.action}</span>
        </KitTableHead>
        {rows.map((row) => (
          <KitTableRow key={row.query} columns={COLUMNS}>
            <span className="truncate font-medium" title={row.query}>
              {row.query}
            </span>
            <span className="justify-end tabular-nums">{fmt.number(row.searches)}</span>
            <span className="justify-end tabular-nums">{fmt.number(row.results)}</span>
            <span className="justify-end tabular-nums">
              {formatRate(discoveryRate(row.clickedSessions, row.sessions))}
            </span>
            <span className="justify-end gap-2">
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
          </KitTableRow>
        ))}
      </KitTable>
    </div>
  )
}
