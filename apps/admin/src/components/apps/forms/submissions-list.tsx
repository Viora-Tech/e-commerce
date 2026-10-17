'use client'

import { siteConfig } from '@commerce/config/site'
import { useEffect, useState } from 'react'
import PageHeader from '@/components/layout/page-header'
import RelativeTime from '@/components/layout/relative-time'
import ResourceTable, { type ResourceColumnSpec } from '@/components/table/resource-table'
import { formsContent } from '@/data/forms'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'

type Row = Awaited<ReturnType<typeof api.forms.submissions.list>>[number]

/** Every message shoppers sent from the theme's contact and advice forms, newest first. */
export default function SubmissionsList() {
  // Hooks
  const copy = useCopy(formsContent.submissions)
  const [rows, setRows] = useState<Row[] | null>(null)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState<number>(siteConfig.ui.rowsPerPage.default)

  useEffect(() => {
    let cancelled = false
    api.forms.submissions.list().then((r) => {
      if (!cancelled) setRows(r)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Event handlers
  const handleQuery = (next: string) => {
    setQuery(next)
    setPage(1)
  }
  const handlePerPage = (next: number) => {
    setPerPage(next)
    setPage(1)
  }

  // Render logic
  const columns: ResourceColumnSpec<Row>[] = [
    {
      id: 'from',
      title: copy.columns.from,
      hideable: false,
      align: 'start',
      className: 'w-60',
      sortValue: (r) => r.name,
      render: (r) => (
        <span className="flex flex-col text-left">
          <span className="font-medium">{r.name || copy.anonymous}</span>
          <span className="text-caption text-muted-foreground">{r.email || r.phone}</span>
        </span>
      ),
    },
    {
      id: 'message',
      title: copy.columns.message,
      align: 'start',
      className: 'w-96 whitespace-normal',
      render: (r) => <span className="line-clamp-3 whitespace-pre-wrap text-left">{r.text}</span>,
    },
    {
      id: 'page',
      title: copy.columns.page,
      align: 'start',
      sortValue: (r) => r.path,
      render: (r) => <span className="text-muted-foreground">{r.path}</span>,
    },
    {
      id: 'received',
      title: copy.columns.received,
      sortValue: (r) => new Date(r.createdAt),
      render: (r) => <RelativeTime value={r.createdAt} />,
    },
  ]
  const needle = query.trim().toLowerCase()
  const matching = (rows ?? []).filter(
    (r) =>
      !needle ||
      [r.name, r.email, r.phone, r.text, r.path].some((v) => v?.toLowerCase().includes(needle)),
  )
  const visible = matching.slice((page - 1) * perPage, page * perPage)

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={copy.title} summary={copy.subtitle} />
      <ResourceTable
        resourceName={copy.resource}
        columns={columns}
        items={visible}
        getId={(r) => r.id}
        selectable={false}
        loading={rows === null}
        query={query}
        onQueryChange={handleQuery}
        page={page}
        perPage={perPage}
        total={matching.length}
        onPageChange={setPage}
        onPerPageChange={handlePerPage}
        empty={{ heading: copy.empty }}
      />
    </div>
  )
}
