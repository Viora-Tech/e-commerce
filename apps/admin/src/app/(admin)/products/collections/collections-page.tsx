'use client'

import { siteConfig } from '@commerce/config/site'
import { ExternalLink, LayoutGrid, Pencil, Plus, Trash2 } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import Link from 'next/link'
import { parseAsInteger, parseAsString, parseAsStringLiteral, useQueryStates } from 'nuqs'
import { Suspense, useState } from 'react'
import { toast } from 'sonner'
import { collectionListColumns } from '@/components/collections/collection-list-columns'
import type { CollectionTab } from '@/components/collections/collection-tiles'
import ConfirmDialog from '@/components/layout/confirm-dialog'
import ProoflyListPage from '@/components/layout/proofly-list-page'
import {
  appliedFromGroups,
  clearGroups,
  FILTER_PANEL_CLASS,
  FilterPanel,
} from '@/components/table/filter-panel'
import ResourceTable from '@/components/table/resource-table'
import RowMenu from '@/components/table/row-menu'
import ViewSelect from '@/components/table/view-select'
import { bulkActionsContent } from '@/data/bulk-actions'
import { collectionFormContent, collectionsListContent } from '@/data/collections'
import { filterPanelContent } from '@/data/filter-panel'
import { useCopy, useFormat } from '@/hooks/use-copy'
import { api } from '@/lib/api-client'
import {
  CLEAR_COLLECTION_FILTERS,
  COLLECTION_FILTER_PARAMS,
  collectionFilterGroups,
  collectionMatcher,
} from '@/lib/collection-list-filters'
import { usePrimaryAction } from '@/lib/primary-action'
import { routes } from '@/lib/routes'
import { runBatched, toastOutcome } from '@/lib/run-batched'

type Collections = Awaited<ReturnType<typeof api.collections.list>>
type Row = Collections[number]

export type CollectionsInitial = {
  collections: Collections
  /** The store's public origin, for the row menu's "View on store". */
  storefrontOrigin: string
}

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
  const panelCopy = useCopy(filterPanelContent)
  usePrimaryAction(routes.products.newCollection())
  const [q, setQ] = useQueryStates(
    {
      query: parseAsString.withDefault(''),
      tab: parseAsStringLiteral(TABS),
      page: parseAsInteger.withDefault(1),
      perPage: parseAsInteger.withDefault(siteConfig.ui.rowsPerPage.default),
      ...COLLECTION_FILTER_PARAMS,
    },
    { shallow: true },
  )
  const [rows, setRows] = useState(initial.collections)
  const shared = useCopy(bulkActionsContent)
  const [deleting, setDeleting] = useState<Row | null>(null)
  const [bulkDeleting, setBulkDeleting] = useState<{ ids: string[]; clear: () => void } | null>(
    null,
  )

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

  const handleBulkDelete = async () => {
    if (!bulkDeleting) return
    const { ids, clear } = bulkDeleting
    const outcome = await runBatched(ids, (id) => api.collections.delete({ id }))
    toastOutcome(outcome, shared.summary)
    clear()
    setRows(await api.collections.list())
  }

  // Render logic
  const stats = {
    total: rows.length,
    automatic: rows.filter((r) => r.kind === 'automatic').length,
    manual: rows.filter((r) => r.kind === 'manual').length,
    empty: rows.filter((r) => r.productCount === 0).length,
  }
  const needle = q.query.trim().toLowerCase()
  const matches = collectionMatcher(q)
  const matching = rows.filter(
    (r) =>
      inTab(r, q.tab) &&
      matches(r) &&
      (needle === '' ||
        r.title.toLowerCase().includes(needle) ||
        r.handle.toLowerCase().includes(needle)),
  )
  const groups = collectionFilterGroups(q, copy.list, (patch) => setQ({ ...patch, page: 1 }))
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
              { label: copy.list.row.edit, icon: Pencil, href: routes.products.collection(c.id) },
              {
                label: copy.list.row.viewOnStore,
                icon: ExternalLink,
                href: `${initial.storefrontOrigin}/collections/${c.handle}`,
                newTab: true,
                hidden: c.status !== 'active',
              },
              {
                label: copy.list.row.delete,
                icon: Trash2,
                destructive: true,
                onSelect: () => setDeleting(c),
              },
            ]}
          />
        )}
        selectable
        bulkActions={(ids, clear) => (
          <Button variant="outline" size="sm" onClick={() => setBulkDeleting({ ids, clear })}>
            <Trash2 aria-hidden="true" />
            {copy.list.bulk.delete}
          </Button>
        )}
        query={q.query}
        onQueryChange={(query) => setQ({ query, page: 1 })}
        onClearAll={() => setQ({ ...CLEAR_COLLECTION_FILTERS, query: '', tab: null, page: 1 })}
        filters={(close) => (
          <FilterPanel
            groups={groups}
            onClear={() => clearGroups(groups)}
            footer={{ label: panelCopy.show(matching.length), onDone: close }}
          />
        )}
        filtersClassName={FILTER_PANEL_CLASS}
        applied={appliedFromGroups(groups, panelCopy)}
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
      <ConfirmDialog
        open={bulkDeleting !== null}
        onOpenChange={(open) => !open && setBulkDeleting(null)}
        title={copy.list.bulk.title(bulkDeleting?.ids.length ?? 0)}
        body={copy.list.bulk.body}
        confirmLabel={copy.list.bulk.confirm}
        cancelLabel={copy.list.bulk.cancel}
        onConfirm={handleBulkDelete}
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
