'use client'

import { siteConfig } from '@commerce/config/site'
import { cn } from '@commerce/ui/lib/utils'
import { useState } from 'react'
import RelativeTime from '@/components/layout/relative-time'
import ResourceTable, { type ResourceColumnSpec } from '@/components/table/resource-table'
import { appsContent } from '@/data/apps'
import { formsContent } from '@/data/forms'
import { useCopy } from '@/hooks/use-copy'
import { useLoad } from '@/hooks/use-load'
import { api } from '@/lib/api-client'
import { PAGE_FILL_CHAIN } from '@/lib/page-fill'

type Row = Awaited<ReturnType<typeof api.forms.submissions.list>>[number]

/** Every message shoppers sent from the theme's contact and advice forms, newest first. */
export default function SubmissionsList() {
  // Hooks
  const copy = useCopy(formsContent.submissions)
  const apps = useCopy(appsContent)
  const { data: rows, failed, retry } = useLoad(() => api.forms.submissions.list())
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState<number>(siteConfig.ui.rowsPerPage.default)

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
          {r.email ? (
            <a className="text-caption text-muted-foreground underline" href={`mailto:${r.email}`}>
              {r.email}
            </a>
          ) : null}
          {r.phone ? (
            <a className="text-caption text-muted-foreground underline" href={`tel:${r.phone}`}>
              {r.phone}
            </a>
          ) : null}
        </span>
      ),
    },
    {
      id: 'message',
      title: copy.columns.message,
      align: 'start',
      className: 'w-96 whitespace-normal',
      // In full: a shopper's question is the whole point of the row, and there is no detail page.
      render: (r) => <span className="whitespace-pre-wrap text-left">{r.text}</span>,
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
    <div className={cn('flex flex-col gap-5', PAGE_FILL_CHAIN)}>
      <ResourceTable
        fill
        resourceName={copy.resource}
        columns={columns}
        items={visible}
        getId={(r) => r.id}
        selectable={false}
        loading={rows === null && !failed}
        error={failed ? { heading: apps.couldNotLoad.submissions, onRetry: retry } : undefined}
        query={query}
        onQueryChange={handleQuery}
        page={page}
        perPage={perPage}
        total={matching.length}
        onPageChange={setPage}
        onPerPageChange={handlePerPage}
        empty={{ heading: copy.empty }}
      />
      <p className="text-caption text-muted-foreground">{copy.emailedNote}</p>
    </div>
  )
}
