'use client'

import type { CampaignRow, SourceRow } from '@commerce/api'
import { formatNumber } from '@commerce/money'
import { ChevronDown } from '@commerce/ui/icons'
import { cn } from '@commerce/ui/lib/utils'
import { TableCell, TableRow } from '@commerce/ui/shadcn/table'
import Link from 'next/link'
import type { CSSProperties } from 'react'
import { Fragment, useState } from 'react'
import DataCard from '@/components/layout/data-card'
import EmptyState from '@/components/layout/empty-state'
import SimpleTable from '@/components/table/simple-table'
import { growthOverviewContent as copy, SOURCE_LABELS } from '@/data/growth'
import { growthSplitContent } from '@/data/growth-report'
import { useCopy } from '@/hooks/use-copy'
import { formatRate } from '@/lib/analytics-range'
import { formatPaiseWhole } from '@/lib/money'
import SourceIcon from './source-icon'
import SplitCell from './split-cell'

type SourceTableCardProps = {
  rows: SourceRow[]
  campaigns: CampaignRow[]
}

const c = copy.sources.columns

/** Width for a row's share-of-sales bar, clamped to a sane range. */
const shareWidth = (share: number) => `${Math.min(100, Math.round(share * 100))}%`

/**
 * Sessions, orders, sales (first-time vs returning) and conversion per friendly source,
 * expandable to that source's campaigns.
 */
export default function SourceTableCard({ rows, campaigns }: SourceTableCardProps) {
  // Hooks
  const split = useCopy(growthSplitContent)
  const [expanded, setExpanded] = useState<string | null>(null)

  // Event handlers
  const handleToggle = (source: string) => {
    setExpanded((current) => (current === source ? null : source))
  }

  // Render logic
  const forSource = (source: string) => campaigns.filter((row) => row.sourceKey === source)

  return (
    <DataCard title={copy.sources.title} flush={rows.length > 0}>
      {rows.length === 0 ? (
        <EmptyState variant="inline" body={copy.sources.empty} />
      ) : (
        <SimpleTable
          className="min-w-[52rem]"
          columns={[
            { key: 'source', label: c.source },
            { key: 'sessions', label: c.sessions, align: 'end' },
            { key: 'orders', label: c.orders, align: 'end' },
            { key: 'sales', label: c.sales, align: 'end' },
            { key: 'new', label: split.newBuyers, align: 'end' },
            { key: 'returning', label: split.returning, align: 'end' },
            { key: 'conversion', label: c.conversion, align: 'end' },
            { key: 'share', label: c.share, align: 'end' },
            { key: 'open', label: '', className: 'w-8' },
          ]}
        >
          {rows.map((row) => {
            const open = expanded === row.source
            const rowCampaigns = forSource(row.source)
            return (
              <Fragment key={row.source}>
                <TableRow className="cursor-pointer" onClick={() => handleToggle(row.source)}>
                  <TableCell className="font-medium">
                    <span className="flex items-center gap-2">
                      <SourceIcon source={row.source} className="size-4 text-muted-foreground" />
                      {SOURCE_LABELS[row.source]}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNumber(row.sessions)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatNumber(row.orders)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatPaiseWhole(row.salesPaise)}
                  </TableCell>
                  <TableCell className="text-right">
                    <SplitCell salesPaise={row.split.newSalesPaise} orders={row.split.newOrders} />
                  </TableCell>
                  <TableCell className="text-right">
                    <SplitCell
                      salesPaise={row.split.returningSalesPaise}
                      orders={row.split.returningOrders}
                    />
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.sessions > 0 ? formatRate(row.conversion) : '-'}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full w-(--w) rounded-full bg-primary"
                          style={{ '--w': shareWidth(row.shareOfSales) } as CSSProperties}
                        />
                      </div>
                      <span className="tabular-nums">{formatRate(row.shareOfSales)}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <ChevronDown
                      className={cn(
                        'size-4 text-muted-foreground transition-transform',
                        open && 'rotate-180',
                      )}
                    />
                  </TableCell>
                </TableRow>
                {open ? (
                  <TableRow className="bg-muted/30">
                    <TableCell colSpan={9} className="py-3">
                      <p className="mb-2 text-period font-medium text-muted-foreground">
                        {copy.sources.campaignsUnder}
                      </p>
                      {rowCampaigns.length === 0 ? (
                        <p className="text-period text-muted-foreground-soft">
                          {copy.sources.noCampaigns}
                        </p>
                      ) : (
                        <ul className="flex flex-col gap-1">
                          {rowCampaigns.map((crow) => (
                            <li
                              key={crow.key}
                              className="flex items-center justify-between gap-3 text-period"
                            >
                              {crow.href ? (
                                <Link href={crow.href} className="text-foreground hover:underline">
                                  {crow.name}
                                </Link>
                              ) : (
                                <span className="text-foreground">{crow.name}</span>
                              )}
                              <span className="tabular-nums text-muted-foreground">
                                {formatPaiseWhole(crow.salesPaise)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </TableCell>
                  </TableRow>
                ) : null}
              </Fragment>
            )
          })}
        </SimpleTable>
      )}
    </DataCard>
  )
}
