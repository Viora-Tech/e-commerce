'use client'

import { siteConfig } from '@commerce/config/site'
import { useQueryStates } from 'nuqs'
import { Suspense, useEffect, useState } from 'react'
import PageHeader from '@/components/layout/page-header'
import ResourceTable from '@/components/table/resource-table'
import ViewSelect from '@/components/table/view-select'
import { appsContent } from '@/data/apps'
import { filterPanelContent } from '@/data/filter-panel'
import { gstAlreadyInvoicedContent } from '@/data/gst-already-invoiced'
import { gstInvoicesContent } from '@/data/gst-invoices'
import { gstListFiltersContent } from '@/data/gst-list-filters'
import { useCopy } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import {
  CLEAR_INVOICE_FILTERS,
  INVOICE_DEFAULT_SORT,
  INVOICE_PARAMS,
  INVOICE_TABS,
  invoiceFilter,
  invoiceFilterGroups,
  invoiceInput,
  parseInvoiceSort,
  sortParam,
} from '@/lib/gst-list-filters'
import { routes } from '@/lib/routes'
import FilingReminder from './filing-reminder'
import { invoiceColumns } from './invoice-columns'
import InvoicesBulkActions from './invoices-bulk-actions'
import { useGstNumbers } from './use-gst-numbers'

type Page = Awaited<ReturnType<typeof api.gstInvoices.list>>
type Progress = { batchId: string; total: number; sent: number; failed: number }

/**
 * Issued and cancelled documents in the shared table: document type views, search (invoice or
 * order number, buyer, GSTIN), Filter (invoice date, GST number, source, status), sortable
 * Number, Date and Total, rows per page; all on the server and kept in the URL. Ticked rows (or
 * every match) download as a zip, print as one PDF, recalculate GST or email to their buyers.
 */
export default function InvoicesList() {
  return (
    <Suspense>
      <InvoicesTable />
    </Suspense>
  )
}

function InvoicesTable() {
  // Hooks
  const copy = useCopy(gstInvoicesContent.list)
  const kinds = useCopy(gstInvoicesContent.kinds)
  const lists = useCopy(gstListFiltersContent)
  const panel = useCopy(filterPanelContent)
  const apps = useCopy(appsContent)
  const recordCopy = useCopy(gstAlreadyInvoicedContent)
  const numbers = useGstNumbers()
  const [q, setQ] = useQueryStates(INVOICE_PARAMS, { shallow: true })
  const [perPage, setPerPage] = useState<number>(siteConfig.ui.rowsPerPage.default)
  const [data, setData] = useState<Page | null>(null)
  const [loading, setLoading] = useState(true)
  /** The last read failed: the table says so with Try again. */
  const [failed, setFailed] = useState(false)
  const [progress, setProgress] = useState<Progress | null>(null)
  // Bumped after a bulk change so the open page reads its rows again.
  const [version, setVersion] = useState(0)

  // biome-ignore lint/correctness/useExhaustiveDependencies: `version` re-runs the load after a bulk change
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api.gstInvoices
      .list(invoiceInput(q, perPage))
      .then(
        (d) => {
          if (cancelled) return
          setData(d)
          setFailed(false)
        },
        () => {
          if (!cancelled) setFailed(true)
        },
      )
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [q, perPage, version])

  useEffect(() => {
    if (!progress || progress.sent + progress.failed >= progress.total) return
    const timer = setTimeout(async () => {
      const b = await api.gstInvoices.batch({ id: progress.batchId })
      setProgress({ ...progress, sent: b.sent, failed: b.failed })
    }, 2000)
    return () => clearTimeout(timer)
  }, [progress])

  // Event handlers
  const handleReload = () => setVersion((v) => v + 1)
  /** Try again: skeleton rows while the same view is read again. */
  const handleRetry = () => {
    setData(null)
    handleReload()
  }

  // Render logic
  const groups = invoiceFilterGroups(q, lists, panel, numbers, (patch) =>
    setQ({ ...patch, page: 1 }),
  )

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title={copy.title} summary={copy.subtitle} />
      <FilingReminder />
      <ResourceTable
        resourceName={lists.invoiceResource}
        columns={invoiceColumns({ list: copy, kinds, lists, record: recordCopy })}
        items={failed ? [] : (data?.rows ?? [])}
        getId={(r) => r.id}
        href={(r) => routes.apps.page('gst-invoices', 'invoices', r.id)}
        loading={loading && data === null}
        query={q.query}
        onQueryChange={(query) => setQ({ query, page: 1 }, { history: 'replace' })}
        onClearAll={() => setQ({ ...CLEAR_INVOICE_FILTERS, page: 1 })}
        views={
          <ViewSelect
            value={q.tab}
            label={copy.kindFilter}
            onChange={(tab) => setQ({ tab, page: 1 })}
            options={INVOICE_TABS.map((t) => ({ value: t, label: copy.tabs[t] }))}
          />
        }
        filterGroups={groups}
        defaultSort={INVOICE_DEFAULT_SORT}
        sort={parseInvoiceSort(q.sort)}
        onSortChange={(s) => setQ({ sort: sortParam(s, INVOICE_DEFAULT_SORT), page: 1 })}
        page={q.page}
        perPage={perPage}
        onPerPageChange={(next) => {
          setPerPage(next)
          setQ({ page: 1 })
        }}
        total={data?.total ?? 0}
        onPageChange={(page) => setQ({ page })}
        loadAllIds={() => api.gstInvoices.listIds(invoiceFilter(q))}
        bulkActions={(ids) => (
          <InvoicesBulkActions
            ids={ids}
            taxInvoices={q.tab === 'tax_invoice'}
            onChanged={handleReload}
            onEmailQueued={(b) => setProgress({ ...b, sent: 0, failed: 0 })}
          />
        )}
        empty={{ heading: copy.empty }}
        error={failed ? { heading: apps.couldNotLoad.invoices, onRetry: handleRetry } : undefined}
      />
      {progress ? (
        <p className="text-caption text-muted-foreground">
          {copy.emailProgress(progress.sent, progress.failed, progress.total)}
        </p>
      ) : null}
    </div>
  )
}
