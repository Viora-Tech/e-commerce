'use client'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@commerce/ui/shadcn/table'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import DataCard from '@/components/layout/data-card'
import RelativeTime from '@/components/layout/relative-time'
import OrderChip from '@/components/orders/order-chip'
import { rtoTabContent as copy, returnsContent } from '@/data/returns'
import { api } from '@/lib/api-client'
import { formatPaise } from '@/lib/money'

type Summary = Awaited<ReturnType<typeof api.returns.rtoSummary>>
type Row = Awaited<ReturnType<typeof api.returns.list>>['items'][number]

/** Shipments → RTO: how many parcels came back, what it cost, and the ones still waiting. */
export default function RtoTab() {
  // Hooks
  const [summary, setSummary] = useState<Summary | null>(null)
  const [rows, setRows] = useState<Row[]>([])

  useEffect(() => {
    let live = true
    api.returns.rtoSummary({ sinceDays: 30 }).then((s) => {
      if (live) setSummary(s)
    })
    api.returns.list({ page: 1, perPage: 50, kind: 'rto' }).then((r) => {
      if (live) setRows(r.items)
    })
    return () => {
      live = false
    }
  }, [])

  // Render logic
  const s = summary

  return (
    <div className="flex flex-col gap-6">
      <p className="text-caption text-muted-foreground">{copy.period}</p>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Tile label={copy.tiles.count} value={s ? String(s.count) : '-'} />
        <Tile
          label={copy.tiles.rate}
          value={s ? `${s.ratePercent}%` : '-'}
          hint={s ? copy.rateOf(s.shipments) : undefined}
        />
        <Tile label={copy.tiles.goods} value={s ? formatPaise(s.goodsPaise) : '-'} />
        <Tile
          label={copy.tiles.courier}
          value={s ? formatPaise(s.courierPaise) : '-'}
          hint={s && s.missingCost > 0 ? copy.missing(s.missingCost) : undefined}
        />
        <Tile label={copy.tiles.open} value={s ? String(s.open) : '-'} />
      </div>
      <DataCard title={copy.listTitle} flush>
        {rows.length === 0 ? (
          <p className="px-4 py-6 text-body text-muted-foreground md:px-6">{copy.empty}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{copy.columns.task}</TableHead>
                <TableHead>{copy.columns.order}</TableHead>
                <TableHead className="hidden md:table-cell">{copy.columns.customer}</TableHead>
                <TableHead className="text-right">{copy.columns.value}</TableHead>
                <TableHead>{copy.columns.status}</TableHead>
                <TableHead className="hidden md:table-cell">{copy.columns.when}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Link href={`/orders/returns/${r.id}`} className="font-medium hover:underline">
                      {r.label}
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Link href={`/orders/${r.orderId}`} className="tabular-nums hover:underline">
                      #{r.orderNumber}
                    </Link>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {r.customerName ?? r.email ?? returnsContent.guest}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatPaise(r.valuePaise)}
                  </TableCell>
                  <TableCell>
                    <OrderChip
                      kind="return"
                      value={r.status}
                      label={returnsContent.rtoStatus[r.status]}
                    />
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <RelativeTime value={r.requestedAt} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </DataCard>
    </div>
  )
}

type TileProps = { label: string; value: string; hint?: string | undefined }

/* A small KPI figure: label, number, optional muted line. */
function Tile({ label, value, hint }: TileProps) {
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border bg-card p-4">
      <span className="text-caption text-muted-foreground">{label}</span>
      <span className="text-xl font-semibold tabular-nums text-ink-strong">{value}</span>
      {hint ? <span className="text-caption text-muted-foreground">{hint}</span> : null}
    </div>
  )
}
