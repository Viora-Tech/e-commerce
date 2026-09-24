'use client'

import { Braces, Pencil, Plus, SquarePlus, Trash2 } from '@commerce/ui/icons'
import { Badge } from '@commerce/ui/shadcn/badge'
import { Button } from '@commerce/ui/shadcn/button'
import { Card } from '@commerce/ui/shadcn/card'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import EmptyState from '@/components/layout/empty-state'
import PageBody from '@/components/layout/page-body'
import PageHeader from '@/components/layout/page-header'
import RelativeTime from '@/components/layout/relative-time'
import ResourceTable, { type ResourceColumnSpec } from '@/components/table/resource-table'
import { entryListContent as copy } from '@/data/metaobjects'
import { api } from '@/lib/api-client'
import { LIST_PER_PAGE } from '@/lib/list-query'
import ConfirmDelete from './confirm-delete'
import { entriesPath, type LoadedDefinition } from './form-state'

type EntriesResult = Awaited<ReturnType<typeof api.metaobjects.entries>>
type EntryRow = EntriesResult['rows'][number]

type EntriesPageProps = {
  definition: LoadedDefinition
  initial: EntriesResult
}

type Pending = { ids: string[]; clear: () => void }

const columns: ResourceColumnSpec<EntryRow>[] = [
  {
    id: 'name',
    title: copy.columns.name,
    sortValue: (e) => e.displayName,
    hideable: false,
    align: 'start',
    className: 'w-96 px-3 whitespace-normal',
    render: (e) => <span className="line-clamp-2 text-left text-body-strong">{e.displayName}</span>,
  },
  {
    id: 'handle',
    title: copy.columns.handle,
    sortValue: (e) => e.handle,
    render: (e) => <span className="font-mono text-caption">{e.handle}</span>,
  },
  {
    id: 'status',
    title: copy.columns.status,
    sortValue: (e) => e.status,
    render: (e) => (
      <Badge variant={e.status === 'active' ? 'success' : 'neutral'}>{copy.status[e.status]}</Badge>
    ),
  },
  {
    id: 'updated',
    title: copy.columns.updated,
    sortValue: (e) => new Date(e.updatedAt),
    render: (e) => <RelativeTime value={e.updatedAt} />,
  },
]

/** Entries of one metaobject definition, searchable, with bulk delete. */
export default function EntriesPage({ definition, initial }: EntriesPageProps) {
  // Hooks
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [result, setResult] = useState(initial)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [deleting, setDeleting] = useState<Pending | null>(null)

  useEffect(() => {
    if (page === 1 && query === '') {
      setResult(initial)
      return
    }
    let cancelled = false
    setLoading(true)
    api.metaobjects
      .entries({
        definitionId: definition.id,
        page,
        perPage: LIST_PER_PAGE,
        query: query || undefined,
      })
      .then((r) => !cancelled && setResult(r))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [definition.id, page, query, initial])

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
          perPage: LIST_PER_PAGE,
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
  const base = entriesPath(definition.type)
  const hasFields = definition.fields.length > 0
  const addHref = `${base}/new`

  return (
    <PageBody width="frame" className="gap-4">
      <PageHeader
        title={definition.name}
        subtitle={definition.description ?? undefined}
        breadcrumbs={[{ label: copy.back, href: '/content/metaobjects' }]}
        actions={
          <>
            <Button
              variant="outline"
              render={<Link href={`${base}/definition`} />}
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
      {!hasFields ? (
        <Card>
          <EmptyState
            icon={Braces}
            heading={copy.noFields.heading}
            body={copy.noFields.body}
            action={
              <Button render={<Link href={`${base}/definition`} />} nativeButton={false}>
                {copy.editDefinition}
              </Button>
            }
          />
        </Card>
      ) : definition.entries === 0 && result.total === 0 && query === '' ? (
        <Card>
          <EmptyState
            icon={Braces}
            heading={copy.empty.heading(definition.name)}
            body={copy.empty.body}
            action={
              <Button render={<Link href={addHref} />} nativeButton={false}>
                <Plus />
                {copy.add}
              </Button>
            }
          />
        </Card>
      ) : (
        <ResourceTable
          size="frame"
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
          perPage={LIST_PER_PAGE}
          total={result.total}
          onPageChange={setPage}
          bulkActions={(ids, clear) => (
            <Button variant="outline" disabled={busy} onClick={() => setDeleting({ ids, clear })}>
              <Trash2 />
              {copy.bulk.delete}
            </Button>
          )}
        />
      )}
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
    </PageBody>
  )
}
