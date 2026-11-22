'use client'

import { siteConfig } from '@commerce/config/site'
import { Button } from '@commerce/ui/shadcn/button'
import { useState } from 'react'
import { toast } from 'sonner'
import PageHeader from '@/components/layout/page-header'
import RelativeTime from '@/components/layout/relative-time'
import StatusLabel from '@/components/status/status-label'
import ResourceTable, { type ResourceColumnSpec } from '@/components/table/resource-table'
import { appsContent } from '@/data/apps'
import { backInStockContent } from '@/data/back-in-stock'
import { useCopy } from '@/hooks/use-copy'
import { useLoad } from '@/hooks/use-load'
import { api } from '@/lib/api-client'
import { errorText } from '@/lib/api-errors'

type Row = Awaited<ReturnType<typeof api.backInStock.signups.list>>[number]

const copy = backInStockContent.signups

const columns: ResourceColumnSpec<Row>[] = [
  {
    id: 'variant',
    title: copy.columns.variant,
    hideable: false,
    align: 'start',
    sortValue: (r) => r.variantLabel,
    render: (r) => <span className="font-medium">{r.variantLabel}</span>,
  },
  {
    id: 'contact',
    title: copy.columns.contact,
    align: 'start',
    sortValue: (r) => r.contact,
    render: (r) => r.contact,
  },
  {
    id: 'status',
    title: copy.columns.status,
    sortValue: (r) => r.status,
    render: (r) => <StatusLabel kind="bisSignup" value={r.status} variant="soft" />,
  },
  {
    id: 'created',
    title: copy.columns.created,
    sortValue: (r) => new Date(r.createdAt),
    render: (r) => <RelativeTime value={r.createdAt} />,
  },
]

/** Every "notify me" signup: who is waiting, for what, and where they are in the double opt-in flow. */
export default function SignupsList() {
  // Hooks
  const apps = useCopy(appsContent)
  const {
    data: rows,
    failed,
    retry,
    setData: setRows,
  } = useLoad(() => api.backInStock.signups.list({}))
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState<number>(siteConfig.ui.rowsPerPage.default)
  const [importing, setImporting] = useState(false)

  // Event handlers
  const handleQuery = (next: string) => {
    setQuery(next)
    setPage(1)
  }
  const handlePerPage = (next: number) => {
    setPerPage(next)
    setPage(1)
  }
  const handleRestockTags = async () => {
    setImporting(true)
    try {
      const r = await api.backInStock.signups.importRestockTags()
      toast.success(copy.restockTagsDone(r.added, r.unmatched.length))
      setRows(await api.backInStock.signups.list({}))
    } catch (err) {
      toast.error(errorText(err, String(err)))
    } finally {
      setImporting(false)
    }
  }

  // Render logic
  const needle = query.trim().toLowerCase()
  const matching = (rows ?? []).filter(
    (r) =>
      !needle ||
      r.variantLabel.toLowerCase().includes(needle) ||
      r.contact.toLowerCase().includes(needle),
  )
  const visible = matching.slice((page - 1) * perPage, page * perPage)

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={copy.title}
        summary={copy.subtitle}
        actions={
          <Button variant="outline" loading={importing} onClick={handleRestockTags}>
            {copy.restockTags}
          </Button>
        }
      />
      <ResourceTable
        resourceName={copy.resource}
        columns={columns}
        items={visible}
        getId={(r) => r.id}
        selectable={false}
        loading={rows === null && !failed}
        error={failed ? { heading: apps.couldNotLoad.signups, onRetry: retry } : undefined}
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
