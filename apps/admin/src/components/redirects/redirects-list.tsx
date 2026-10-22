'use client'

import { siteConfig } from '@commerce/config/site'
import { ArrowRight, Download, Plus, Trash2, Upload } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { saveFile } from '@/components/apps/gst-invoices/save-file'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import PageHeader from '@/components/layout/page-header'
import ProoflyDetailPage from '@/components/layout/proofly-detail-page'
import ResourceTable, { type ResourceColumnSpec } from '@/components/table/resource-table'
import { type RedirectListItem, redirectsContent } from '@/data/redirects'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import ImportRedirectsDialog from './import-redirects-dialog'
import RedirectActions from './redirect-actions'
import RedirectDialog from './redirect-dialog'

type RedirectsListProps = {
  initial: { items: RedirectListItem[]; total: number }
}

export default function RedirectsList({ initial }: RedirectsListProps) {
  // Hooks
  const copy = useCopy(redirectsContent)
  const fmt = useFormat()
  const [data, setData] = useState(initial)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState<number>(siteConfig.ui.rowsPerPage.default)
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [importing, setImporting] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [editing, setEditing] = useState<RedirectListItem | null>(null)
  const [removing, setRemoving] = useState<{ ids: string[]; clear: () => void } | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (
      version === 0 &&
      page === 1 &&
      query === '' &&
      perPage === siteConfig.ui.rowsPerPage.default
    ) {
      return
    }
    let live = true
    setLoading(true)
    const timer = setTimeout(() => {
      api.redirects
        .list({ page, perPage, query: query || undefined, sort: 'newest' })
        .then((next) => {
          if (live) setData(next)
        })
        .catch(() => toast.error(copy.dialog.failed))
        .finally(() => {
          if (live) setLoading(false)
        })
    }, 200)
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [page, perPage, query, version, copy.dialog.failed])

  // Event handlers
  const handleQuery = (next: string) => {
    setQuery(next)
    setPage(1)
  }

  const handlePerPage = (next: number) => {
    setPerPage(next)
    setPage(1)
  }

  const handleChanged = () => setVersion((v) => v + 1)

  const handleRemove = async () => {
    if (!removing) return
    try {
      const n = await api.redirects.delete({ ids: removing.ids })
      toast.success(copy.actions.deleted(n))
      removing.clear()
      handleChanged()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.actions.deleteFailed)
      throw err
    }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      saveFile(await api.redirects.exportCsv())
      toast.success(copy.csv.exported)
    } catch {
      toast.error(copy.csv.exportFailed)
    } finally {
      setExporting(false)
    }
  }

  // Render logic
  const columns: ResourceColumnSpec<RedirectListItem>[] = [
    {
      id: 'path',
      title: copy.columns.path,
      hideable: false,
      render: (r) => <span className="font-medium break-all text-ink-strong">{r.path}</span>,
    },
    {
      id: 'target',
      title: copy.columns.target,
      render: (r) => (
        <span className="flex items-center gap-2 break-all text-muted-foreground">
          <ArrowRight className="size-3.5 shrink-0" aria-hidden="true" />
          {r.target}
        </span>
      ),
    },
    {
      id: 'source',
      title: copy.columns.source,
      render: (r) => <span className="text-muted-foreground">{copy.source[r.source]}</span>,
    },
    {
      id: 'updated',
      title: copy.columns.updated,
      align: 'end',
      render: (r) => <span className="text-muted-foreground">{fmt.when(r.updatedAt)}</span>,
    },
  ]
  const addButton = (
    <Button type="button" onClick={() => setCreating(true)}>
      <Plus />
      {copy.add}
    </Button>
  )

  return (
    <ProoflyDetailPage
      header={
        <PageHeader
          title={copy.title}
          summary={copy.summary(data.total)}
          back={{ label: copy.back, href: routes.content.menus() }}
          actions={
            <>
              <Button
                type="button"
                variant="outline"
                onClick={handleExport}
                disabled={exporting || data.total === 0}
              >
                <Download aria-hidden="true" />
                {copy.csv.export}
              </Button>
              <Button type="button" variant="outline" onClick={() => setImporting(true)}>
                <Upload aria-hidden="true" />
                {copy.csv.import}
              </Button>
              {addButton}
            </>
          }
        />
      }
      main={
        <ResourceTable
          resourceName={copy.resource}
          columns={columns}
          items={data.items}
          getId={(r) => r.id}
          loading={loading}
          query={query}
          onQueryChange={handleQuery}
          page={page}
          perPage={perPage}
          total={data.total}
          onPageChange={setPage}
          onPerPageChange={handlePerPage}
          selectable
          bulkActions={(ids, clear) => (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => setRemoving({ ids, clear })}
            >
              <Trash2 aria-hidden="true" />
              {copy.actions.deleteSelected(ids.length)}
            </Button>
          )}
          rowActions={(r) => (
            <RedirectActions
              onEdit={() => setEditing(r)}
              onDelete={() => setRemoving({ ids: [r.id], clear: () => {} })}
            />
          )}
          empty={
            query
              ? { heading: copy.empty.searchHeading }
              : { heading: copy.empty.heading, body: copy.empty.body, action: addButton }
          }
        />
      }
    >
      {creating || editing ? (
        <RedirectDialog
          redirect={editing}
          onClose={() => {
            setCreating(false)
            setEditing(null)
          }}
          onSaved={handleChanged}
        />
      ) : null}
      {importing ? (
        <ImportRedirectsDialog onClose={() => setImporting(false)} onImported={handleChanged} />
      ) : null}
      {removing ? (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setRemoving(null)}
          title={copy.actions.confirmTitle(removing.ids.length)}
          body={copy.actions.confirmBody}
          confirmLabel={copy.actions.delete}
          cancelLabel={copy.actions.cancel}
          stopPropagation
          onConfirm={handleRemove}
        />
      ) : null}
    </ProoflyDetailPage>
  )
}
