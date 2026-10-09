'use client'

import { Braces, Pencil, SquarePlus, Trash2 } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import EmptyState from '@/components/layout/empty-state'
import ProoflyDetailPage from '@/components/layout/proofly-detail-page'
import ProoflyPageHeader from '@/components/layout/proofly-page-header'
import StatusChip from '@/components/layout/status-chip'
import ResourceTable, { type ResourceColumnSpec } from '@/components/table/resource-table'
import { entryListContent } from '@/data/metaobjects'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { routes } from '@/lib/routes'
import ConfirmDelete from './confirm-delete'
import { entriesPath, type LoadedDefinition } from './form-state'

type EntriesResult = Awaited<ReturnType<typeof api.metaobjects.entries>>
type EntryRow = EntriesResult['rows'][number]

type EntriesPageProps = {
  definition: LoadedDefinition
  initial: EntriesResult
  /** Rows per page the server fetched `initial` with. */
  initialPerPage: number
}

type Pending = { ids: string[]; clear: () => void }

type ListCopy = typeof entryListContent

const columnsFor = (
  copy: ListCopy,
  fmt: ReturnType<typeof useFormat>,
): ResourceColumnSpec<EntryRow>[] => [
  {
    id: 'name',
    title: copy.columns.name,
    sortValue: (e) => e.displayName,
    hideable: false,
    align: 'start',
    className: 'w-96 px-3 whitespace-normal',
    render: (e) => (
      <span className="flex min-w-0 flex-col text-left">
        <span className="line-clamp-2 font-medium text-ink-strong">{e.displayName}</span>
        <span className="truncate text-caption text-muted-foreground">{e.handle}</span>
      </span>
    ),
  },
  {
    id: 'status',
    title: copy.columns.status,
    sortValue: (e) => e.status,
    align: 'center',
    render: (e) => <StatusChip>{copy.status[e.status]}</StatusChip>,
  },
  {
    id: 'updated',
    title: copy.columns.updated,
    sortValue: (e) => new Date(e.updatedAt),
    align: 'end',
    render: (e) => <span className="text-muted-foreground">{fmt.day(e.updatedAt)}</span>,
  },
]

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
  const [busy, setBusy] = useState(false)
  const [deleting, setDeleting] = useState<Pending | null>(null)

  useEffect(() => {
    if (page === 1 && query === '' && perPage === initialPerPage) {
      setResult(initial)
      return
    }
    let cancelled = false
    setLoading(true)
    api.metaobjects
      .entries({
        definitionId: definition.id,
        page,
        perPage,
        query: query || undefined,
      })
      .then((r) => !cancelled && setResult(r))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [definition.id, page, perPage, query, initial, initialPerPage])

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
      setResult(
        await api.metaobjects.entries({
          definitionId: definition.id,
          page,
          perPage,
          query: query || undefined,
        }),
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.bulk.failed)
    } finally {
      setBusy(false)
    }
  }

  // Render logic
  const columns = columnsFor(copy, fmt)
  const base = entriesPath(definition.type)
  const hasFields = definition.fields.length > 0
  const addHref = routes.content.newEntry(definition.type)
  const noEntries = definition.entries === 0 && result.total === 0 && query === ''

  return (
    <ProoflyDetailPage
      header={
        <ProoflyPageHeader
          title={definition.name}
          summary={definition.description ?? copy.summary(definition.entries)}
          back={{ label: copy.back, href: routes.content.contentTypes() }}
          actions={
            <>
              <Button
                variant="key-neutral"
                render={<Link href={routes.content.contentTypeDefinition(definition.type)} />}
                nativeButton={false}
              >
                <Pencil />
                {copy.editDefinition}
              </Button>
              {hasFields && definition.entries > 0 ? (
                <Button render={<Link href={addHref} />} nativeButton={false}>
                  <SquarePlus strokeWidth={1.6} />
                  {copy.add}
                </Button>
              ) : null}
            </>
          }
        />
      }
      main={
        !hasFields ? (
          <div className="rounded-2xl border bg-card shadow-card">
            <EmptyState
              icon={Braces}
              heading={copy.noFields.heading}
              body={copy.noFields.body}
              action={
                <Button
                  render={<Link href={routes.content.contentTypeDefinition(definition.type)} />}
                  nativeButton={false}
                >
                  {copy.editDefinition}
                </Button>
              }
            />
          </div>
        ) : noEntries ? (
          <div className="rounded-2xl border bg-card shadow-card">
            <EmptyState
              icon={Braces}
              heading={copy.empty.heading(definition.name)}
              body={copy.empty.body}
              action={
                <Button render={<Link href={addHref} />} nativeButton={false}>
                  <SquarePlus strokeWidth={1.6} />
                  {copy.add}
                </Button>
              }
            />
          </div>
        ) : (
          <ResourceTable
            resourceName={copy.resource}
            columns={columns}
            items={result.rows}
            getId={(e) => e.id}
            href={(e) => `${base}/${e.id}`}
            loading={loading}
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
              <Button variant="outline" disabled={busy} onClick={() => setDeleting({ ids, clear })}>
                <Trash2 />
                {copy.bulk.delete}
              </Button>
            )}
          />
        )
      }
    >
      <ConfirmDelete
        open={deleting !== null}
        busy={busy}
        title={copy.bulk.confirmTitle(deleting?.ids.length ?? 0)}
        body={copy.bulk.confirmBody}
        confirm={copy.bulk.confirm}
        cancel={copy.bulk.cancel}
        onOpenChange={(open) => !open && setDeleting(null)}
        onConfirm={handleConfirmDelete}
      />
    </ProoflyDetailPage>
  )
}
