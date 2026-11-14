'use client'

import { returnReasonLabel } from '@commerce/core/returns'
import { Button } from '@commerce/ui/shadcn/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@commerce/ui/shadcn/table'
import Link from 'next/link'
import { useState } from 'react'
import { CELL, HEAD } from '@/components/apps/gst-invoices/table-classes'
import LoadFailedState from '@/components/apps/shared/load-failed-state'
import DataCard from '@/components/layout/data-card'
import PageHeader from '@/components/layout/page-header'
import StatStrip from '@/components/layout/stat-strip'
import TableEmptyRow from '@/components/table/table-empty-row'
import TableSkeletonRows from '@/components/table/table-skeleton-rows'
import { appsContent } from '@/data/apps'
import { codRtoContent } from '@/data/cod-rto'
import { returnsContent } from '@/data/returns'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { useLoad } from '@/hooks/use-load'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import PeriodTabs, { type Period } from './period-tabs'

/** Why customers send things back, and the products that come back most. */
export default function ReturnReasonsPage() {
  // Hooks
  const copy = useCopy(codRtoContent)
  const labels = useCopy(returnsContent)
  const apps = useCopy(appsContent)
  const f = useFormat()
  const [period, setPeriod] = useState<Period>('90')
  const { data, failed, retry } = useLoad(
    () => api.codRto.returnReasons({ days: Number(period) }),
    [period],
  )

  // Render logic
  const c = copy.returns

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={c.title}
        summary={c.subtitle}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <PeriodTabs value={period} onChange={setPeriod} />
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href={routes.settings.returns()} />}
            >
              {c.settingsLink}
            </Button>
          </div>
        }
      />
      {failed ? (
        <LoadFailedState
          size="page"
          heading={apps.couldNotLoad.reasons}
          failed={failed}
          onRetry={retry}
        />
      ) : (
        <>
          <StatStrip
            loading={!data}
            placeholders={3}
            tiles={
              data
                ? [
                    { id: 'returns', label: c.returns, value: f.number(data.returns) },
                    { id: 'exchanges', label: c.exchanges, value: f.number(data.exchanges) },
                    { id: 'auto', label: c.autoApproved, value: f.number(data.autoApproved) },
                  ]
                : []
            }
          />
          <DataCard title={c.reasonsTitle} flush>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className={HEAD}>{c.columns.reason}</TableHead>
                  <TableHead className={`${HEAD} text-right`}>{c.columns.returns}</TableHead>
                  <TableHead className={`${HEAD} text-right`}>{c.columns.units}</TableHead>
                  <TableHead className={`${HEAD} text-right`}>{c.columns.value}</TableHead>
                  <TableHead className={`${HEAD} text-right`}>{c.columns.share}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data === null ? (
                  <TableSkeletonRows
                    columns={5}
                    rows={4}
                    cellClassName={CELL}
                    label={c.reasonsTitle}
                  />
                ) : data.reasons.length === 0 ? (
                  <TableEmptyRow colSpan={5} message={c.empty} />
                ) : null}
                {(data?.reasons ?? []).map((r) => (
                  <TableRow key={r.reason}>
                    <TableCell className={`${CELL} font-medium`}>
                      {returnReasonLabel(r.reason, labels.reasons)}
                    </TableCell>
                    <TableCell className={`${CELL} text-right tabular-nums`}>
                      {f.number(r.returns)}
                    </TableCell>
                    <TableCell className={`${CELL} text-right tabular-nums`}>
                      {f.number(r.units)}
                    </TableCell>
                    <TableCell className={`${CELL} text-right tabular-nums`}>
                      {f.money(r.valuePaise)}
                    </TableCell>
                    <TableCell className={`${CELL} text-right tabular-nums`}>
                      {`${f.number(r.sharePercent)}%`}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DataCard>
          <DataCard title={c.productsTitle} flush>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className={HEAD}>{c.columns.product}</TableHead>
                  <TableHead className={`${HEAD} text-right`}>{c.columns.returns}</TableHead>
                  <TableHead className={`${HEAD} text-right`}>{c.columns.value}</TableHead>
                  <TableHead className={HEAD}>{c.columns.topReason}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data === null ? (
                  <TableSkeletonRows
                    columns={4}
                    rows={4}
                    cellClassName={CELL}
                    label={c.productsTitle}
                  />
                ) : data.products.length === 0 ? (
                  <TableEmptyRow colSpan={4} message={c.empty} />
                ) : null}
                {(data?.products ?? []).map((p) => (
                  <TableRow key={p.productId}>
                    <TableCell className={`${CELL} font-medium`}>{p.title}</TableCell>
                    <TableCell className={`${CELL} text-right tabular-nums`}>
                      {f.number(p.returns)}
                    </TableCell>
                    <TableCell className={`${CELL} text-right tabular-nums`}>
                      {f.money(p.valuePaise)}
                    </TableCell>
                    <TableCell className={`${CELL} text-muted-foreground`}>
                      {p.topReason ? returnReasonLabel(p.topReason, labels.reasons) : null}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DataCard>
        </>
      )}
    </div>
  )
}
