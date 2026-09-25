'use client'

import { ArrowRight, Plus } from '@commerce/ui/icons'
import { Button } from '@commerce/ui/shadcn/button'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import PageBody from '@/components/layout/page-body'
import ResourceTable, { type ResourceColumnSpec } from '@/components/table/resource-table'
import { type RedirectListItem, redirectsContent } from '@/data/redirects'
import { api } from '@/lib/api-client'
import { formatDate } from '@/lib/format-date'
import DeleteRedirectsDialog from './delete-redirects-dialog'
import RedirectActions from './redirect-actions'
import RedirectDialog from './redirect-dialog'

type RedirectsListProps = {
  initial: { items: RedirectListItem[]; total: number }
}

const copy = redirectsContent
const PER_PAGE = 50

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
    render: (r) => (
      <span className="text-muted-foreground tabular-nums">{formatDate(r.updatedAt)}</span>
    ),
  },
]

export default function RedirectsList({ initial }: RedirectsListProps) {
  // Hooks
  const [data, setData] = useState(initial)
  const [query, setQuery] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<RedirectListItem | null>(null)
  const [removing, setRemoving] = useState<{ ids: string[]; clear: () => void } | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (version === 0 && page === 1 && query === '') return
    let live = true
    setLoading(true)
    const timer = setTimeout(() => {
      api.redirects
        .list({ page, perPage: PER_PAGE, query: query || undefined })
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
  }, [page, query, version])

  // Event handlers
  const handleQuery = (next: string) => {
    setQuery(next)
    setPage(1)
  }

  const handleChanged = () => setVersion((v) => v + 1)

  // Render logic
  const addButton = (
    <Button type="button" onClick={() => setCreating(true)}>
      <Plus />
      {copy.add}
    </Button>
  )

  return (
    <PageBody>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-prose text-body text-muted-foreground">{copy.intro}</p>
        {addButton}
      </div>
      <ResourceTable
        resourceName={{ singular: 'redirect', plural: 'redirects' }}
        columns={columns}
        items={data.items}
        getId={(r) => r.id}
        loading={loading}
        query={query}
        onQueryChange={handleQuery}
        page={page}
        perPage={PER_PAGE}
        total={data.total}
        onPageChange={setPage}
        selectable
        bulkActions={(ids, clear) => (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => setRemoving({ ids, clear })}
          >
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
      {removing ? (
        <DeleteRedirectsDialog
          ids={removing.ids}
          onClose={() => setRemoving(null)}
          onDeleted={() => {
            removing.clear()
            handleChanged()
          }}
        />
      ) : null}
    </PageBody>
  )
}
