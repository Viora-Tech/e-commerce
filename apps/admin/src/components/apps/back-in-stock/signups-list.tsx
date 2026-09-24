'use client'

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@commerce/ui/shadcn/table'
import { useEffect, useState } from 'react'
import DataCard from '@/components/layout/data-card'
import PageHeader from '@/components/layout/page-header'
import RelativeTime from '@/components/layout/relative-time'
import StatusLabel from '@/components/status/status-label'
import { backInStockContent } from '@/data/back-in-stock'
import { api } from '@/lib/api-client'

type Row = Awaited<ReturnType<typeof api.backInStock.signups.list>>[number]

const copy = backInStockContent.signups

/** Every "notify me" signup: who is waiting, for what, and where they are in the double opt-in flow. */
export default function SignupsList() {
  // Hooks
  const [rows, setRows] = useState<Row[] | null>(null)

  useEffect(() => {
    let cancelled = false
    api.backInStock.signups.list({}).then((r) => {
      if (!cancelled) setRows(r)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Render logic
  const list = rows ?? []

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={copy.title} subtitle={copy.subtitle} />
      <DataCard title={copy.title} flush>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{copy.columns.variant}</TableHead>
              <TableHead>{copy.columns.contact}</TableHead>
              <TableHead>{copy.columns.status}</TableHead>
              <TableHead className="text-right">{copy.columns.created}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows && list.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                  {copy.empty}
                </TableCell>
              </TableRow>
            ) : null}
            {list.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.variantLabel}</TableCell>
                <TableCell>{r.contact}</TableCell>
                <TableCell>
                  <StatusLabel kind="bisSignup" value={r.status} />
                </TableCell>
                <TableCell className="text-right">
                  <RelativeTime value={r.createdAt} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataCard>
    </div>
  )
}
