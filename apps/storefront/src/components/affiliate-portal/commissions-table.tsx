'use client'

import type { PortalSale } from '@commerce/plugin-affiliates/server'
import { Badge } from '@commerce/ui/shadcn/badge'
import { NativeSelect, NativeSelectOption } from '@commerce/ui/shadcn/native-select'
import { Tabs, TabsList, TabsTrigger } from '@commerce/ui/shadcn/tabs'
import { type ReactNode, useState } from 'react'
import { affiliatePortalContent } from '@/data/affiliate-portal'
import CommissionsGrid from './commissions-grid'
import TablePagination from './table-pagination'

type CommissionsTableProps = {
  rows: PortalSale[]
  empty: string
  /** Shown instead of the table while there are no commissions at all (shadcn's Empty). */
  none?: ReactNode
  /** Filters and Export, at the end of the tabs row (dashboard-01's "Customize Columns"). */
  toolbar?: ReactNode
  /** Rows per page to start with. */
  pageSize?: number | undefined
}

type Tab = 'all' | 'pending' | 'approved' | 'paid' | 'reversed'

const copy = affiliatePortalContent.commissions

const TABS: Tab[] = ['all', 'pending', 'approved', 'paid', 'reversed']

/**
 * dashboard-01's DataTable for commissions: status tabs with counts (a select on a narrow page), a toolbar slot, the table in
 * a bordered box with a muted header row, and pagination below. Customer names are masked.
 */
export default function CommissionsTable({
  rows,
  empty,
  none,
  toolbar,
  pageSize: firstSize = 10,
}: CommissionsTableProps) {
  // Hooks
  const [tab, setTab] = useState<Tab>('all')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(firstSize)

  // Event handlers
  const handleTab = (value: unknown) => {
    setTab(TABS.find((t) => t === value) ?? 'all')
    setPage(0)
  }
  const handlePageSize = (size: number) => {
    setPageSize(size)
    setPage(0)
  }

  // Render logic
  const count = (t: Tab) => (t === 'all' ? rows.length : rows.filter((r) => r.status === t).length)
  const shown = tab === 'all' ? rows : rows.filter((r) => r.status === tab)
  const pageRows = shown.slice(page * pageSize, (page + 1) * pageSize)
  return (
    <Tabs value={tab} onValueChange={handleTab} className="w-full flex-col justify-start gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 lg:px-6">
        <NativeSelect
          size="sm"
          aria-label={copy.filters.status}
          className="@4xl/main:hidden"
          value={tab}
          onChange={(e) => handleTab(e.target.value)}
        >
          {TABS.map((t) => (
            <NativeSelectOption key={t} value={t}>
              {t === 'all' ? copy.tabs[t] : `${copy.tabs[t]} (${count(t)})`}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <TabsList className="hidden @4xl/main:flex **:data-[slot=badge]:size-5 **:data-[slot=badge]:rounded-full **:data-[slot=badge]:bg-muted-foreground/30 **:data-[slot=badge]:px-1">
          {TABS.map((t) => (
            <TabsTrigger key={t} value={t}>
              {copy.tabs[t]}
              {t !== 'all' && count(t) > 0 ? <Badge variant="secondary">{count(t)}</Badge> : null}
            </TabsTrigger>
          ))}
        </TabsList>
        {toolbar ? <div className="flex flex-wrap items-center gap-2">{toolbar}</div> : null}
      </div>
      <div className="px-4 lg:px-6">
        <div className="overflow-hidden rounded-lg border">
          <CommissionsGrid rows={pageRows} empty={rows.length === 0 && none ? none : empty} />
        </div>
      </div>
      {shown.length > 0 ? (
        <TablePagination
          total={shown.length}
          page={page}
          pageSize={pageSize}
          onPage={setPage}
          onPageSize={handlePageSize}
        />
      ) : null}
    </Tabs>
  )
}
