'use client'

import { siteConfig } from '@commerce/config/site'
import { cn } from '@commerce/ui/lib/utils'
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
import { PAGE_FILL_CHAIN } from '@/lib/page-fill'
import { exportSignups } from './export-signups'

type Row = Awaited<ReturnType<typeof api.backInStock.signups.list>>[number]

/** Every "notify me" signup: who is waiting, for what, and where they are in the double opt-in flow. */
export default function SignupsList() {
  // Hooks
  const { signups: copy, overview } = useCopy(backInStockContent)
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
  const [exporting, setExporting] = useState(false)

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

  const handleExport = async () => {
    setExporting(true)
    await exportSignups({
      header: copy.csvHeader,
      file: overview.exportFile,
      failed: overview.exportFailed,
    })
    setExporting(false)
  }

  // Render logic
  const columns: ResourceColumnSpec<Row>[] = [
    {
      id: 'variant',
      title: copy.columns.variant,
      hideable: false,
      align: 'start',
      // Product names run long ("ATK Blazing Sky F1 V3 Series Esports Wireless Mouse"): the
      // column takes a fixed share and wraps, like Products and Customers, so it never runs into
      // Contact. The product sits on up to two lines with the variant muted under it.
      className: 'w-[40%] whitespace-normal',
      minWidth: 16,
      sortValue: (r) => r.variantLabel,
      render: (r) => (
        <span className="flex min-w-0 flex-col text-left" title={r.variantLabel}>
          <span className="line-clamp-2 font-medium text-ink-strong">{r.productTitle}</span>
          {r.variantTitle ? (
            <span className="truncate text-caption text-muted-foreground">{r.variantTitle}</span>
          ) : null}
        </span>
      ),
    },
    {
      id: 'contact',
      title: copy.columns.contact,
      align: 'start',
      className: 'w-[26%]',
      minWidth: 12,
      sortValue: (r) => r.contact,
      render: (r) => (
        <span className="block truncate" title={r.contact}>
          {r.contact}
        </span>
      ),
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
  const needle = query.trim().toLowerCase()
  const matching = (rows ?? []).filter(
    (r) =>
      !needle ||
      r.variantLabel.toLowerCase().includes(needle) ||
      r.contact.toLowerCase().includes(needle),
  )
  const visible = matching.slice((page - 1) * perPage, page * perPage)

  return (
    <div className={cn('flex flex-col gap-5', PAGE_FILL_CHAIN)}>
      <PageHeader
        title={copy.title}
        summary={copy.subtitle}
        actions={
          <>
            <Button variant="outline" loading={exporting} onClick={handleExport}>
              {copy.exportSignups}
            </Button>
            <Button variant="outline" loading={importing} onClick={handleRestockTags}>
              {copy.restockTags}
            </Button>
          </>
        }
      />
      <ResourceTable
        fill
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
