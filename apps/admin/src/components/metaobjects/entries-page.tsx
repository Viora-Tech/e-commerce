'use client'

import { Braces, Pencil, Plus, Trash2 } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import EmptyState from '@/components/layout/empty-state'
import PageHeader from '@/components/layout/page-header'
import ProoflyDetailPage from '@/components/layout/proofly-detail-page'
import ResourceTable from '@/components/table/resource-table'
import { entryListContent } from '@/data/metaobjects'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import { entryColumns } from './entry-columns'
import { entriesPath, type LoadedDefinition } from './form-state'

type EntriesResult = Awaited<ReturnType<typeof api.metaobjects.entries>>

type EntriesPageProps = {
  definition: LoadedDefinition
  initial: EntriesResult
  /** Rows per page the server fetched `initial` with. */
  initialPerPage: number
}

type Pending = { ids: string[]; clear: () => void }

/** Entries of one content type (metaobject definition), searchable, with bulk delete. */
export default function EntriesPage({ definition, initial, initialPerPage }: EntriesPageProps) {
  // Hooks
  const copy = useCopy(entryListContent)
  const fmt = useFormat()
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [perPage, setPerPage] = useState(initialPerPage)
  const [result, setResult] = useState(initial)
  const [loading, setLoading] = useState(false)
  /* A failed read shows "Could not load entries" with Try again in the table, not old rows. */
  const [failed, setFailed] = useState(false)
  const [attempt, setAttempt] = useState(0)
  const [busy, setBusy] = useState(false)
  const [deleting, setDeleting] = useState<Pending | null>(null)

  useEffect(() => {
    if (attempt === 0 && page === 1 && query === '' && perPage === initialPerPage) {
      setResult(initial)
      return
    }
    let cancelled = false
    setLoading(true)
    setFailed(false)
    api.metaobjects
      .entries({
        definitionId: definition.id,
        page,
        perPage,
        query: query || undefined,
      })
      .then((r) => !cancelled && setResult(r))
      .catch(() => !cancelled && setFailed(true))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [definition.id, page, perPage, query, initial, initialPerPage, attempt])

  // Event handlers
  const handleConfirmDelete = async () => {
    if (!deleting) return
    const { ids, clear } = deleting
    setDeleting(null)
    setBusy(true)
    try {
      await api.metaobjects.deleteEntries({ ids })
      toast.success(copy.bulk.deleted(ids.length))
      clear()
      // The rows are read again; a failed read lands in the table with Try again.
      setAttempt((n) => n + 1)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.bulk.failed)
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  const columns = entryColumns(copy, fmt)
  const base = entriesPath(definition.type)
  const hasFields = definition.fields.length > 0
  const addHref = routes.content.newEntry(definition.type)
  const noEntries = definition.entries === 0 && result.total === 0 && query === ''

  return (
    <ProoflyDetailPage
      header={
        <PageHeader
          title={definition.name}
          summary={definition.description ?? copy.summary(definition.entries)}
          back={{ label: copy.back, href: routes.content.contentTypes() }}
          actions={
            <>
              <Button
                variant="outline"
                render={<Link href={routes.content.contentTypeDefinition(definition.type)} />}
                nativeButton={false}
              >
                <Pencil />
                {copy.editDefinition}
              </Button>
              {hasFields && definition.entries > 0 ? (
                <Button render={<Link href={addHref} />} nativeButton={false}>
                  <Plus strokeWidth={1.6} />
                  {copy.add}
                </Button>
              ) : null}
            </>
          }
        />
      }
      main={
        !hasFields ? (
          <EmptyState
            variant="page"
            icon={Braces}
            heading={copy.noFields.heading}
            body={copy.noFields.body}
            action={
              <Button
                render={<Link href={routes.content.contentTypeDefinition(definition.type)} />}
                nativeButton={false}
              >
                <Pencil strokeWidth={1.6} aria-hidden="true" />
                {copy.editDefinition}
              </Button>
            }
          />
        ) : noEntries ? (
          <EmptyState
            variant="page"
            icon={Braces}
            size="lg"
            heading={copy.empty.heading(definition.name)}
            body={copy.empty.body}
            action={
              <Button render={<Link href={addHref} />} nativeButton={false}>
                <Plus strokeWidth={1.6} />
                {copy.add}
              </Button>
            }
          />
        ) : (
          <ResourceTable
            resourceName={copy.resource}
            columns={columns}
            items={result.rows}
            getId={(e) => e.id}
            href={(e) => `${base}/${e.id}`}
            loading={loading}
            error={
              failed
                ? { heading: copy.loadFailed, onRetry: () => setAttempt((n) => n + 1) }
                : undefined
            }
            query={query}
            onQueryChange={(q) => {
              setQuery(q)
              setPage(1)
            }}
            page={page}
            perPage={perPage}
            total={result.total}
            onPageChange={setPage}
            onPerPageChange={(n) => {
              setPerPage(n)
              setPage(1)
            }}
            bulkActions={(ids, clear) => (
              <Button
                variant="outline"
                size="sm"
                loading={busy}
                disabled={busy}
                onClick={() => setDeleting({ ids, clear })}
              >
                <Trash2 />
                {copy.bulk.delete}
              </Button>
            )}
          />
        )
      }
    >
      <ConfirmDialog
        tone="destructive"
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={copy.bulk.confirmTitle(deleting?.ids.length ?? 0)}
        body={copy.bulk.confirmBody}
        confirmLabel={copy.bulk.confirm}
        cancelLabel={copy.bulk.cancel}
        busy={busy}
        onConfirm={() => void handleConfirmDelete()}
      />
    </ProoflyDetailPage>
  )
}
