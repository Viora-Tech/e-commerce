'use client'

import { Badge } from '@commerce/ui/shadcn/badge'
import { Button } from '@commerce/ui/shadcn/button'
import { Input } from '@commerce/ui/shadcn/input'
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
import StatusLabel from '@/components/status/status-label'
import { shipmentsContent } from '@/data/shipments'
import { api } from '@/lib/api-client'
import BookShipmentsPanel from './book-shipments-panel'

type ListResult = Awaited<ReturnType<typeof api.shipments.list>>

const copy = shipmentsContent.list
const PER_PAGE = 25

/** Every shipment, searchable, with a link back to its order and a print/track shortcut. */
export default function ShipmentsTab() {
  // Hooks
  const [result, setResult] = useState<ListResult | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    // reloadKey has no bearing on the query itself; bumping it just re-runs this effect
    // after a bulk booking, the same way customers-page.tsx re-runs its list on demand.
    if (reloadKey < 0) return
    let cancelled = false
    api.shipments.list({ page, perPage: PER_PAGE, search: search || undefined }).then((r) => {
      if (!cancelled) setResult(r)
    })
    return () => {
      cancelled = true
    }
  }, [page, search, reloadKey])

  // Event handlers
  const handleBooked = () => setReloadKey((k) => k + 1)

  // Render logic
  const rows = result?.items ?? []
  const totalPages = result ? Math.max(1, Math.ceil(result.total / PER_PAGE)) : 1

  return (
    <div className="flex flex-col gap-4">
      <BookShipmentsPanel onBooked={handleBooked} />
      <DataCard
        title={copy.heading}
        flush
        action={
          <Input
            placeholder={copy.search}
            value={search}
            onChange={(e) => {
              setPage(1)
              setSearch(e.target.value)
            }}
            className="w-56"
          />
        }
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{copy.columns.order}</TableHead>
              <TableHead>{copy.columns.waybill}</TableHead>
              <TableHead>{copy.columns.provider}</TableHead>
              <TableHead>{copy.columns.status}</TableHead>
              <TableHead>{copy.columns.insured}</TableHead>
              <TableHead className="text-right">{copy.columns.updated}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {result && rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  {copy.empty}
                </TableCell>
              </TableRow>
            ) : null}
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  <Link href={`/orders/${r.orderId}`} className="font-medium hover:underline">
                    #{r.orderNumber}
                  </Link>
                </TableCell>
                <TableCell className="font-mono text-caption">{r.waybill}</TableCell>
                <TableCell className="capitalize">{r.provider}</TableCell>
                <TableCell>
                  <StatusLabel kind="shipment" value={r.status} />
                </TableCell>
                <TableCell>{r.insured ? <Badge variant="outline">✓</Badge> : null}</TableCell>
                <TableCell className="text-right">
                  <RelativeTime value={r.updatedAt} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {totalPages > 1 ? (
          <div className="flex items-center justify-end gap-2 border-t px-4 py-3">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <span className="text-caption text-muted-foreground">
              {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        ) : null}
      </DataCard>
    </div>
  )
}
