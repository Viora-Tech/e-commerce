'use client'

import { siteConfig } from '@commerce/config/site'
import { LayoutGrid, Plus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs'
import { Suspense, useState } from 'react'
import { toast } from 'sonner'
import { collectionListColumns } from '@/components/collections/collection-list-columns'
import CollectionTiles, { type CollectionTab } from '@/components/collections/collection-tiles'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import ProoflyListPage from '@/components/layout/proofly-list-page'
import ResourceTable from '@/components/table/resource-table'
import RowMenu from '@/components/table/row-menu'
import ViewSelect from '@/components/table/view-select'
import { collectionFormContent, collectionsListContent } from '@/data/collections'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import { usePrimaryAction } from '@/lib/primary-action'
import { routes } from '@/lib/routes'

type Collections = Awaited<ReturnType<typeof api.collections.list>>
type Row = Collections[number]

export type CollectionsInitial = { collections: Collections }

const TABS = ['automatic', 'manual', 'empty'] as const

function inTab(row: Row, tab: CollectionTab | null): boolean {
  if (tab === 'automatic') return row.kind === 'automatic'
  if (tab === 'manual') return row.kind === 'manual'
  if (tab === 'empty') return row.productCount === 0
  return true
}

function CollectionsContent({ initial }: { initial: CollectionsInitial }) {
  // Hooks
  const copy = useCopy(collectionsListContent)
  const { delete: deleteCopy } = useCopy(collectionFormContent)
  const fmt = useFormat()
  usePrimaryAction(routes.products.newCollection())
  const [q, setQ] = useQueryStates(
    {
      query: parseAsString.withDefault(''),
      tab: parseAsStringLiteral(TABS),
      page: parseAsInteger.withDefault(1),
      perPage: parseAsInteger.withDefault(siteConfig.ui.rowsPerPage.default),
    },
    { shallow: true },
  )
  const [rows, setRows] = useState(initial.collections)
  const [deleting, setDeleting] = useState<Row | null>(null)

  // Event handlers
  const handleConfirmDelete = async () => {
    const target = deleting
    if (!target) return
    setDeleting(null)
    try {
      await api.collections.delete({ id: target.id })
      setRows((prev) => prev.filter((r) => r.id !== target.id))
      toast.success(copy.list.deleted)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : copy.list.deleteFailed)
    }
  }

  // Render logic
  const stats = {
    total: rows.length,
    automatic: rows.filter((r) => r.kind === 'automatic').length,
    manual: rows.filter((r) => r.kind === 'manual').length,
    empty: rows.filter((r) => r.productCount === 0).length,
  }
  const needle = q.query.trim().toLowerCase()
  const matching = rows.filter(
    (r) => inTab(r, q.tab) && (needle === '' || r.title.toLowerCase().includes(needle)),
  )
  const pageRows = matching.slice((q.page - 1) * q.perPage, q.page * q.perPage)

  return (
    <ProoflyListPage
      title={copy.title}
      summary={copy.summary(stats.total, stats.automatic, stats.empty)}
      actions={
        <Button render={<Link href={routes.products.newCollection()} />} nativeButton={false}>
          <Plus strokeWidth={1.6} />
          {copy.newCollection}
        </Button>
      }
      stats={
        rows.length === 0 ? undefined : (
          <CollectionTiles stats={stats} tab={q.tab} onSelect={(tab) => setQ({ tab, page: 1 })} />
        )
      }
    >
      <ResourceTable
        resourceName={copy.list.resource}
        columns={collectionListColumns(copy.list, fmt)}
        items={pageRows}
        getId={(c) => c.id}
        href={(c) => routes.products.collection(c.id)}
        rowActions={(c) => (
          <RowMenu
            items={[
              { label: copy.list.row.edit, href: routes.products.collection(c.id) },
              { label: copy.list.row.delete, destructive: true, onSelect: () => setDeleting(c) },
            ]}
          />
        )}
        selectable
        query={q.query}
        onQueryChange={(query) => setQ({ query, page: 1 })}
        onClearAll={() => setQ({ query: '', tab: null, page: 1 })}
        views={
          <ViewSelect
            value={q.tab}
            onChange={(tab) => setQ({ tab, page: 1 })}
            options={[
              { value: null, label: copy.list.tabs.all, count: stats.total },
              { value: 'automatic', label: copy.list.tabs.automatic, count: stats.automatic },
              { value: 'manual', label: copy.list.tabs.manual, count: stats.manual },
              { value: 'empty', label: copy.list.tabs.empty, count: stats.empty },
            ]}
          />
        }
        page={q.page}
        perPage={q.perPage}
        total={matching.length}
        onPageChange={(page) => setQ({ page })}
        onPerPageChange={(perPage) => setQ({ perPage, page: 1 })}
        empty={
          rows.length === 0
            ? {
                heading: copy.noCollections.heading,
                body: copy.noCollections.body,
                action: (
                  <Button
                    render={<Link href={routes.products.newCollection()} />}
                    nativeButton={false}
                  >
                    <LayoutGrid />
                    {copy.noCollections.action}
                  </Button>
                ),
              }
            : { heading: copy.list.empty.heading, body: copy.list.empty.body }
        }
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={deleteCopy.heading}
        body={deleteCopy.body}
        confirmLabel={deleteCopy.confirm}
        cancelLabel={deleteCopy.cancel}
        onConfirm={() => void handleConfirmDelete()}
      />
    </ProoflyListPage>
  )
}

/** `useQueryStates` needs a Suspense boundary on a server-rendered page. */
export default function CollectionsPage({ initial }: { initial: CollectionsInitial }) {
  // Render logic
  return (
    <Suspense>
      <CollectionsContent initial={initial} />
    </Suspense>
  )
}
