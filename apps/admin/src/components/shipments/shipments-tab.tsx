'use client'

import { Badge } from '@commerce/ui/shadcn/badge'
import { Button } from '@commerce/ui/shadcn/button'
import { Input } from '@commerce/ui/shadcn/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@commerce/ui/shadcn/select'
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

type ListResult = Awaited<ReturnType<typeof api.shipments.list>>
type Courier = { id: string; label: string }

const copy = shipmentsContent.list
const ANY_COURIER = '__any'
const PER_PAGE = 25

/** Every shipment, searchable and filterable by courier, with a link back to its order and a
 *  print/track shortcut. */
export default function ShipmentsTab() {
  // Hooks
  const [result, setResult] = useState<ListResult | null>(null)
  const [couriers, setCouriers] = useState<Courier[]>([])
  const [search, setSearch] = useState('')
  const [courier, setCourier] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    api.store.getShipping().then((r) => {
      const byId = new Map(r.available.map((p) => [p.id, p.label]))
      setCouriers(r.settings.enabled.map((id) => ({ id, label: byId.get(id) ?? id })))
    })
  }, [])

  useEffect(() => {
    let cancelled = false
    api.shipments
      .list({
        page,
        perPage: PER_PAGE,
        search: search || undefined,
        provider: courier || undefined,
      })
      .then((r) => {
        if (!cancelled) setResult(r)
      })
    return () => {
      cancelled = true
    }
  }, [page, search, courier])

  // Event handlers
  const handleCourierChange = (value: string) => {
    setPage(1)
    setCourier(value === ANY_COURIER ? '' : value)
  }

  // Render logic
  const rows = result?.items ?? []
  const totalPages = result ? Math.max(1, Math.ceil(result.total / PER_PAGE)) : 1

  return (
    <div className="flex flex-col gap-4">
      <DataCard
        title={copy.heading}
        flush
        action={
          <div className="flex flex-wrap items-center gap-2">
            {couriers.length > 1 ? (
              <Select
                value={courier || ANY_COURIER}
                onValueChange={(v) => handleCourierChange(String(v))}
              >
                <SelectTrigger aria-label={copy.filters.courier} className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ANY_COURIER}>{copy.filters.allCouriers}</SelectItem>
                  {couriers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            <Input
              placeholder={copy.search}
              value={search}
              onChange={(e) => {
                setPage(1)
                setSearch(e.target.value)
              }}
              className="w-56"
            />
          </div>
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
