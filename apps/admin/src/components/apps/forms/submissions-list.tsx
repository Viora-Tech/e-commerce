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
import { formsContent } from '@/data/forms'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type Row = Awaited<ReturnType<typeof api.forms.submissions.list>>[number]

/** Every message shoppers sent from the theme's contact and advice forms, newest first. */
export default function SubmissionsList() {
  // Hooks
  const copy = useCopy(formsContent.submissions)
  const [rows, setRows] = useState<Row[] | null>(null)

  useEffect(() => {
    let cancelled = false
    api.forms.submissions.list().then((r) => {
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
              <TableHead>{copy.columns.from}</TableHead>
              <TableHead>{copy.columns.message}</TableHead>
              <TableHead>{copy.columns.page}</TableHead>
              <TableHead className="text-right">{copy.columns.received}</TableHead>
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
                <TableCell className="align-top">
                  <div className="font-medium">{r.name || copy.anonymous}</div>
                  <div className="text-muted-foreground text-sm">{r.email || r.phone}</div>
                </TableCell>
                <TableCell className="max-w-[32rem] whitespace-pre-wrap align-top">
                  {r.text}
                </TableCell>
                <TableCell className="align-top text-muted-foreground">{r.path}</TableCell>
                <TableCell className="text-right align-top">
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
